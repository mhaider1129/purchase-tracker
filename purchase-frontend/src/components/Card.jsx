// src/components/Card.jsx
import React from 'react';

const Card = ({ children, className = '' }) => (
  <div className={`bg-white shadow rounded p-4 ${className}`}>
    {children}
  </div>
);

export default Card;