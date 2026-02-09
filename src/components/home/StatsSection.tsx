const stats = [
  { value: "2,400+", label: "Community Members" },
  { value: "180+", label: "Projects Launched" },
  { value: "45", label: "Countries Represented" },
  { value: "1M+", label: "Lives Impacted" },
];

const StatsSection = () => {
  return (
    <section className="bg-secondary py-16" aria-labelledby="stats-heading">
      <div className="container">
        <h2 id="stats-heading" className="sr-only">
          Our impact in numbers
        </h2>
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-heading text-3xl font-extrabold text-primary md:text-4xl">
                {stat.value}
              </p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
