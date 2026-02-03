import React, { useMemo, useState } from "react";
import { Database, Lock, Search } from "lucide-react";
import Navbar from "../components/Navbar";

const itemMasterCatalog = [
  {
    id: "MED-001",
    category: "Medications",
    itemName: "Paracetamol 500 mg tablet",
    genericName: "Paracetamol",
    approvedBrands: ["Panadol", "Tylenol"],
    alternatives: ["Ibuprofen 400 mg tablet"],
    specs: ["500 mg", "Oral tablet", "Blister pack"],
    storageConditions: "Store at 15-25°C, protect from moisture.",
    criticalityClass: "Class A (Essential)",
  },
  {
    id: "MED-002",
    category: "Medications",
    itemName: "Amoxicillin 500 mg capsule",
    genericName: "Amoxicillin",
    approvedBrands: ["Amoxil", "Moxatag"],
    alternatives: ["Cefalexin 500 mg capsule"],
    specs: ["500 mg", "Oral capsule", "30-count bottle"],
    storageConditions: "Store below 25°C; keep tightly closed.",
    criticalityClass: "Class A (Essential)",
  },
  {
    id: "SUP-001",
    category: "Medical supplies",
    itemName: "Sterile nitrile examination gloves",
    approvedBrands: ["Ansell", "Medline"],
    alternatives: ["Latex-free vinyl gloves"],
    specs: ["Powder-free", "Size S-XL", "Box of 100"],
    storageConditions: "Cool, dry storage; avoid direct sunlight.",
    criticalityClass: "Class A (Critical)",
  },
  {
    id: "DEV-001",
    category: "Medical devices",
    itemName: "Infusion pump (volumetric)",
    approvedBrands: ["Baxter Sigma", "BD Alaris"],
    alternatives: ["Syringe pump"],
    specs: ["Battery backup 6 hrs", "Flow rate 0.1-1200 ml/hr"],
    storageConditions: "Store indoors; calibrate every 12 months.",
    criticalityClass: "Class A (Life-support)",
  },
  {
    id: "GAS-001",
    category: "Gases",
    itemName: "Medical oxygen cylinder (50L)",
    approvedBrands: ["Air Liquide", "Linde"],
    alternatives: ["On-site oxygen concentrator"],
    specs: ["99.5% purity", "Pin index safety system"],
    storageConditions: "Secure upright; keep away from heat sources.",
    criticalityClass: "Class A (Critical)",
  },
  {
    id: "ITS-001",
    category: "IT & services",
    itemName: "Workstation support service",
    approvedBrands: ["Dell ProSupport", "HP Care Pack"],
    alternatives: ["On-site managed services"],
    specs: ["NBD on-site response", "24/7 phone support"],
    storageConditions: "Service-based; no storage required.",
    criticalityClass: "Class B (Operational)",
  },
];

const ItemMasterPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = useMemo(() => {
    const uniqueCategories = new Set(itemMasterCatalog.map((item) => item.category));
    return ["All", ...Array.from(uniqueCategories)];
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return itemMasterCatalog.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" || item.category === selectedCategory;
      const matchesSearch =
        !normalizedSearch ||
        [
          item.itemName,
          item.genericName,
          item.category,
          item.approvedBrands.join(" "),
          item.alternatives.join(" "),
          item.specs.join(" "),
          item.storageConditions,
          item.criticalityClass,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [searchTerm, selectedCategory]);

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide">
              Central Item Master
            </p>
            <h1 className="text-3xl font-bold text-gray-900">Item Master Data</h1>
            <p className="text-gray-600 mt-1">
              Single catalog for medications (generic-first), medical supplies, medical devices,
              gases, and IT & services.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-blue-800 shadow-sm">
            <Database size={20} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide">Catalog items</p>
              <p className="text-2xl font-bold">{itemMasterCatalog.length}</p>
            </div>
          </div>
        </header>

        <section className="mb-6 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Lock size={18} />
            <p className="text-sm font-semibold">Read-only for institutes.</p>
            <p className="text-sm text-amber-800">
              No institute can create items; submit additions or changes through the central SCM
              workflow.
            </p>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Controls captured
            </p>
            <ul className="mt-2 grid gap-2 text-sm text-gray-700">
              <li>Approved brands &amp; alternatives</li>
              <li>Specifications &amp; storage conditions</li>
              <li>Criticality class assignments</li>
            </ul>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Categories covered
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories
                .filter((category) => category !== "All")
                .map((category) => (
                  <span
                    key={category}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700"
                  >
                    {category}
                  </span>
                ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Catalog overview</h2>
              <p className="text-sm text-gray-600">
                Search and filter to review approved items and controls.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <Search size={16} className="text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search items, brands, or specs"
                  className="w-48 bg-transparent text-sm text-gray-700 focus:outline-none"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Item (generic-first)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Approved brands
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Alternatives
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Specs
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Storage
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Criticality
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">
                        {item.genericName || item.itemName}
                      </div>
                      <p className="text-xs text-gray-500">
                        {item.genericName ? item.itemName : item.id}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.category}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.approvedBrands.join(", ")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.alternatives.join(", ")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.specs.join(", ")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.storageConditions}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                      {item.criticalityClass}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredItems.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              No catalog items match the current filters.
            </div>
          )}
        </section>
      </main>
    </>
  );
};

export default ItemMasterPage;