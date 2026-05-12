// src/components/Card.jsx
import React from "react";

const Card = ({ children, className = "" }) => (
  <div className={`token-card ${className}`}>{children}</div>
);

export default Card;
