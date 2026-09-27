import { describe, expect, it } from "vitest";
import { Constants } from "@/integrations/supabase/types";
import {
  ACCEPT_ATTRIBUTE,
  DESCRIPTION_PROMPTS,
  MAX_BYTES,
  MAX_DESCRIPTION_LENGTH,
  MAX_FILE_NAME_LENGTH,
  MAX_MEDIA_PER_PROBLEM,
  MEDIA_KIND_LABELS,
  MEDIA_TYPES,
  formatBytes,
  mediaKindFor,
  mediaLinkText,
  mediaStoragePath,
  needsDescription,
  pendingDescriptionErrors,
  randomToken,
  sortChosenFiles,
  storedFileName,
  validateMediaDescription,
  validateMediaFile,
} from "@/lib/media";

const MB = 1024 * 1024;
const USER = "8f14e45f-ceea-467a-9575-1a2b3c4d5e6f";
const PROBLEM = "c9f0f895-fb98-4b91-8b3a-6f7e8d9c0b1a";

const file = (name: string, type: string, size = 1000) => ({ name, type, size });

describe("mediaKindFor", () => {
  it("maps each allowed type to its kind", () => {
    expect(mediaKindFor("image/png")).toBe("image");
    expect(mediaKindFor("image/jpeg")).toBe("image");
    expect(mediaKindFor("video/webm")).toBe("video");
    expect(mediaKindFor("application/pdf")).toBe("document");
  });

  it("refuses SVG, HTML and unknown types", () => {
    expect(mediaKindFor("image/svg+xml")).toBeNull();
    expect(mediaKindFor("text/html")).toBeNull();
    expect(mediaKindFor("")).toBeNull();
  });

  it("offers exactly the allowed types in the file picker", () => {
    expect(ACCEPT_ATTRIBUTE.split(",").sort()).toEqual(Object.keys(MEDIA_TYPES).sort());
  });

  it("labels and prompts every kind in the database enum", () => {
    for (const kind of Constants.public.Enums.media_kind) {
      expect(MEDIA_KIND_LABELS[kind]).toBeTruthy();
      expect(DESCRIPTION_PROMPTS[kind]).toBeTruthy();
      expect(MAX_BYTES[kind]).toBeGreaterThan(0);
    }
  });
});

describe("needsDescription", () => {
  it("requires a text alternative for images and video only", () => {
    expect(needsDescription("image")).toBe(true);
    expect(needsDescription("video")).toBe(true);
    expect(needsDescription("document")).toBe(false);
  });
});

describe("formatBytes", () => {
  it("uses the unit a person would expect", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1.5 * MB)).toBe("1.5 MB");
  });
});

describe("validateMediaFile", () => {
  it("accepts a file of an allowed type within its limit", () => {
    expect(validateMediaFile(file("ramp.jpg", "image/jpeg", MAX_BYTES.image))).toBeNull();
    expect(validateMediaFile(file("walk.mp4", "video/mp4", 20 * MB))).toBeNull();
  });

  it("names the file and the reason when the type is not allowed", () => {
    const message = validateMediaFile(file("logo.svg", "image/svg+xml"));
    expect(message).toMatch(/logo\.svg/);
    expect(message).toMatch(/not a supported file type/);
  });

  it("refuses empty files", () => {
    expect(validateMediaFile(file("blank.png", "image/png", 0))).toMatch(/empty/);
  });

  it("applies the limit of the file's own kind", () => {
    // 6 MB is fine for a PDF but too big for an image.
    expect(validateMediaFile(file("scan.pdf", "application/pdf", 6 * MB))).toBeNull();
    const message = validateMediaFile(file("photo.png", "image/png", 6 * MB));
    expect(message).toMatch(/photo\.png is 6\.0 MB/);
    expect(message).toMatch(/at most 5\.0 MB/);
    expect(validateMediaFile(file("long.webm", "video/webm", MAX_BYTES.video + 1))).not.toBeNull();
  });
});

describe("validateMediaDescription", () => {
  it("requires a description for images and video", () => {
    expect(validateMediaDescription("image", "   ", "a.png")).toMatch(/Describe what the image a\.png shows/);
    expect(validateMediaDescription("video", "", "b.mp4")).toMatch(/Describe what happens in the video b\.mp4/);
  });

  it("lets a PDF go without one", () => {
    expect(validateMediaDescription("document", "", "c.pdf")).toBeNull();
  });

  it("caps the length", () => {
    const long = "x".repeat(MAX_DESCRIPTION_LENGTH + 1);
    expect(validateMediaDescription("image", long, "a.png")).toMatch(/1000 characters/);
    expect(validateMediaDescription("image", "x".repeat(MAX_DESCRIPTION_LENGTH), "a.png")).toBeNull();
  });
});

describe("pendingDescriptionErrors", () => {
  it("keys problems by pending id and skips valid entries", () => {
    const errors = pendingDescriptionErrors([
      { id: "one", kind: "image", description: "", file: new File(["x"], "a.png", { type: "image/png" }) },
      { id: "two", kind: "image", description: "A ramp", file: new File(["x"], "b.png", { type: "image/png" }) },
      { id: "three", kind: "document", description: "", file: new File(["x"], "c.pdf", { type: "application/pdf" }) },
    ]);
    expect(Object.keys(errors)).toEqual(["one"]);
  });
});

describe("sortChosenFiles", () => {
  it("separates acceptable files from ones it explains away", () => {
    const { accepted, rejected } = sortChosenFiles(
      [file("a.png", "image/png"), file("b.exe", "application/x-msdownload"), file("c.pdf", "application/pdf")],
      10,
    );
    expect(accepted.map((a) => [a.file.name, a.kind])).toEqual([
      ["a.png", "image"],
      ["c.pdf", "document"],
    ]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatch(/b\.exe/);
  });

  it("stops at the per-problem limit and says why", () => {
    const { accepted, rejected } = sortChosenFiles(
      [file("a.png", "image/png"), file("b.png", "image/png"), file("c.png", "image/png")],
      2,
    );
    expect(accepted).toHaveLength(2);
    expect(rejected).toEqual([
      `c.png was not added: a problem can have at most ${MAX_MEDIA_PER_PROBLEM} files.`,
    ]);
  });

  it("treats a negative slot count as none left", () => {
    expect(sortChosenFiles([file("a.png", "image/png")], -3).accepted).toHaveLength(0);
  });
});

describe("storedFileName", () => {
  it("trims and falls back for blank names", () => {
    expect(storedFileName("  ramp.png ")).toBe("ramp.png");
    expect(storedFileName("   ")).toBe("file");
  });

  it("fits the column", () => {
    expect(storedFileName("a".repeat(400))).toHaveLength(MAX_FILE_NAME_LENGTH);
  });
});

describe("mediaLinkText", () => {
  it("reads as name, type and size", () => {
    expect(mediaLinkText({ file_name: "report.pdf", kind: "document", size_bytes: 1.2 * MB })).toBe(
      "report.pdf (PDF, 1.2 MB)",
    );
  });
});

describe("mediaStoragePath", () => {
  it("puts the file under <user>/<problem>/ with a random name", () => {
    const path = mediaStoragePath(USER, PROBLEM, file("My Ramp Photo.PNG", "image/png"), "abc123");
    expect(path).toBe(`${USER}/${PROBLEM}/abc123.png`);
  });

  it("takes the extension from the type, not the uploaded name", () => {
    expect(mediaStoragePath(USER, PROBLEM, file("photo.html", "image/png"), "r1")).toBe(
      `${USER}/${PROBLEM}/r1.png`,
    );
    expect(mediaStoragePath(USER, PROBLEM, file("clip", "video/mp4"), "r2")).toBe(
      `${USER}/${PROBLEM}/r2.mp4`,
    );
  });

  it("never lets the uploaded name into the path", () => {
    const path = mediaStoragePath(USER, PROBLEM, file("../../etc/passwd.pdf", "application/pdf"), "r3");
    expect(path).toBe(`${USER}/${PROBLEM}/r3.pdf`);
    expect(path.split("/")).toHaveLength(3);
  });

  it("refuses ids that would move the object out of its folder", () => {
    expect(() => mediaStoragePath("../other", PROBLEM, file("a.png", "image/png"), "r")).toThrow();
    expect(() => mediaStoragePath(USER, "a/b", file("a.png", "image/png"), "r")).toThrow();
    expect(() => mediaStoragePath(USER, PROBLEM, file("a.png", "image/png"), "x.y")).toThrow();
  });

  it("uses a fresh random name by default", () => {
    const a = mediaStoragePath(USER, PROBLEM, file("a.png", "image/png"));
    const b = mediaStoragePath(USER, PROBLEM, file("a.png", "image/png"));
    expect(a).not.toBe(b);
    expect(a).toMatch(new RegExp(`^${USER}/${PROBLEM}/[A-Za-z0-9-]+\\.png$`));
  });
});

describe("randomToken", () => {
  it("is a plain identifier usable as a path segment", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9-]+$/);
  });
});
