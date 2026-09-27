// Element ids the page returns focus to when a dialog closes. Ids rather than
// document.activeElement: Safari does not focus a button when it is clicked,
// and after a save or delete the button that opened the dialog may be gone.

/** A routine's Edit button under My routines. */
export const editButtonId = (routineId: string) => `companion-edit-${routineId}`;

/** A routine's Delete button under My routines. */
export const deleteButtonId = (routineId: string) => `companion-delete-${routineId}`;

/** A routine's Start button under Today. */
export const startButtonId = (routineId: string) => `companion-start-${routineId}`;

/** "Add a routine" above My routines. */
export const ADD_ROUTINE_BUTTON_ID = "companion-add-routine";

/** "Make my own routine" in the empty state. */
export const MAKE_OWN_BUTTON_ID = "companion-make-own";

/** The "My routines" heading, where focus goes after a delete. */
export const MY_ROUTINES_HEADING_ID = "companion-my-routines";

/** The "Get started" heading shown when there are no routines. */
export const GET_STARTED_HEADING_ID = "companion-get-started";
