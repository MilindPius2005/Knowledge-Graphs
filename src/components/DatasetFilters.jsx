import { useEffect, useState } from 'react';
import { getFilterOptions } from '../services/ontologyApi.js';
import SkillMultiSelect from './SkillMultiSelect.jsx';

const emptyOptions = {
  clients: [],
  deploymentStatuses: [],
  employees: [],
  skillGroups: [],
  skills: [],
  benchAging: { min: 0, max: 120 },
  campusLaterals: [],
};

export default function DatasetFilters({ filters, onFiltersChange, refreshKey = 0, username, onResetGraph }) {
  const [options, setOptions] = useState(emptyOptions);

  useEffect(() => {
    getFilterOptions(username).then(setOptions).catch(() => setOptions(emptyOptions));
  }, [refreshKey, username]); // re-fetch every time a new file is ingested or username changes

  function updateFilter(name, value) {
    onFiltersChange((current) => ({ ...current, [name]: value }));
  }

  function resetFilters() {
    // Objective 7: Full reset — clear filters, search, graph, everything
    if (onResetGraph) {
      onResetGraph();
    } else {
      onFiltersChange({
        ssl: false,
        benchMin: '',
        benchMax: '',
        clientName: '',
        deploymentStatus: '',
        employee: '',
        campusLateral: '',
        skillGroup: '',
        skills: [],
      });
    }
  }

  return (
    <section className="sidebar-section filter-section">
      <div className="section-heading">Filters</div>


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
        label="Campus/Lateral"
        value={filters.campusLateral}
        onChange={(value) => updateFilter('campusLateral', value)}
        options={options.campusLaterals}
      />
      <FilterSelect
        label="Skill group"
        value={filters.skillGroup}
        onChange={(value) => updateFilter('skillGroup', value)}
        options={options.skillGroups}
      />

      <SkillMultiSelect
        selected={filters.skills || []}
        options={options.skills}
        onChange={(skills) => updateFilter('skills', skills)}
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
