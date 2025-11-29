export const isCardExpired = (expDate: string): boolean => {
  const [month, year] = expDate.split("/");
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear() % 100;
  const currentMonth = currentDate.getMonth() + 1;

  const expMonth = parseInt(month, 10);
  const expYear = parseInt(year, 10);

  return (
    expYear < currentYear ||
    (expYear === currentYear && expMonth < currentMonth)
  );
};
