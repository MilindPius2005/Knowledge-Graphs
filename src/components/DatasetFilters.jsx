import { useEffect, useState } from 'react';
import { getFilterOptions } from '../services/ontologyApi.js';

const emptyOptions = {
  clients: [],
  deploymentStatuses: [],
  employees: [],
  performanceManagers: [],
  skillGroups: [],
  skills: [],
  benchAging: { min: 0, max: 120 },
};

export default function DatasetFilters({ filters, onFiltersChange, refreshKey = 0 }) {
  const [options, setOptions] = useState(emptyOptions);

  useEffect(() => {
    getFilterOptions().then(setOptions).catch(() => setOptions(emptyOptions));
  }, [refreshKey]); // re-fetch every time a new file is ingested

  function updateFilter(name, value) {
    onFiltersChange((current) => ({ ...current, [name]: value }));
  }

  function resetFilters() {
    onFiltersChange({
      ssl: false,
      benchMin: '',
      benchMax: '',
      clientName: '',
      deploymentStatus: '',
      employee: '',
      performanceManager: '',
      skillGroup: '',
      skill: '',
    });
  }

  return (
    <section className="sidebar-section filter-section">
      <div className="section-heading">Filters</div>

      <label className="filter-check">
        <input
          type="checkbox"
          checked={filters.ssl}
          onChange={(event) => updateFilter('ssl', event.target.checked)}
        />
        <span>SSL - Lighthouse data only</span>
      </label>

      <div className="filter-range">
        <span>Bench aging</span>
        <div>
          <input
            type="number"
            min={options.benchAging.min}
            max={options.benchAging.max}
            value={filters.benchMin}
            placeholder="Min"
            onChange={(event) => updateFilter('benchMin', event.target.value)}
            aria-label="Minimum bench aging"
          />
          <input
            type="number"
            min={options.benchAging.min}
            max={options.benchAging.max}
            value={filters.benchMax}
            placeholder="Max"
            onChange={(event) => updateFilter('benchMax', event.target.value)}
            aria-label="Maximum bench aging"
          />
        </div>
      </div>

      <FilterSelect
        label="Client name"
        value={filters.clientName}
        onChange={(value) => updateFilter('clientName', value)}
        options={options.clients}
      />
      <FilterSelect
        label="Deployment status"
        value={filters.deploymentStatus}
        onChange={(value) => updateFilter('deploymentStatus', value)}
        options={options.deploymentStatuses}
      />
      <FilterSelect
        label="Employee"
        value={filters.employee}
        onChange={(value) => updateFilter('employee', value)}
        options={options.employees}
      />
      <FilterSelect
        label="Performance manager"
        value={filters.performanceManager}
        onChange={(value) => updateFilter('performanceManager', value)}
        options={options.performanceManagers}
      />
      <FilterSelect
        label="Skill group"
        value={filters.skillGroup}
        onChange={(value) => updateFilter('skillGroup', value)}
        options={options.skillGroups}
      />
      <FilterSelect
        label="Skill"
        value={filters.skill}
        onChange={(value) => updateFilter('skill', value)}
        options={options.skills}
      />

      <button className="secondary-button filter-reset" type="button" onClick={resetFilters}>
        Reset Filters
      </button>
    </section>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
