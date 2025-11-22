import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api/axios";

const sortProjectsByName = (list) =>
  [...list].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

const ProjectSelector = ({ value, onChange, disabled = false, user }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const normalizedValue = value ?? "";
  const canManageProjects = useMemo(() => {
    const role = (user?.role || "").toLowerCase();
    return role === "scm" || role === "admin";
  }, [user?.role]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/projects");
      setProjects(sortProjectsByName(data || []));
    } catch (err) {
      console.error("❌ Failed to load projects:", err);
      setError(err?.response?.data?.message || "Unable to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleAddProject = async () => {
    const name = window.prompt("Enter new project name");
    if (!name || !name.trim()) {
      return;
    }
    try {
      const { data } = await api.post("/api/projects", { name: name.trim() });
      setProjects((prev) => sortProjectsByName([...prev, data]));
      if (onChange) {
        onChange(String(data.id));
      }
      setError("");
    } catch (err) {
      console.error("❌ Failed to create project:", err);
      const message =
        err?.response?.data?.message || "Failed to create project";
      setError(message);
      alert(message);
    }
  };

  return (
    <div>
      <label className="block font-semibold mb-1">Project (optional)</label>
      <div className="flex gap-2 items-start">
        <select
          className="p-2 border rounded flex-1"
          value={normalizedValue}
          onChange={(e) => onChange?.(e.target.value || "")}
          disabled={disabled || loading}
        >
          <option value="">No linked project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        {canManageProjects && (
          <button
            type="button"
            onClick={handleAddProject}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={disabled}
          >
            Add Project
          </button>
        )}
      </div>
      {loading && (
        <p className="text-sm text-gray-500 mt-1">Loading projects...</p>
      )}
      {error && !loading && (
        <p className="text-sm text-red-600 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default ProjectSelector;
