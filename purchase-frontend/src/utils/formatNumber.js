const formatNumber = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return "0";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(num);
};

export default formatNumber;