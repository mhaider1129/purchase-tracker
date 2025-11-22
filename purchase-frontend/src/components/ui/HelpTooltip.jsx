import React from "react";

const HelpTooltip = ({ text }) => {
  return (
    <span className="relative inline-block group ml-1 cursor-help">
      <span className="text-blue-600 border border-blue-600 rounded-full px-1 leading-none text-xs">
        ?
      </span>
      <span className="absolute z-10 hidden group-hover:block left-1/2 -translate-x-1/2 -top-7 bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
        {text}
      </span>
    </span>
  );
};

export { HelpTooltip };
