// Fetch coordinates from postcode
export const fetchCoordinatesFromPostcode = async (postcode: string) => {
  try {
    const response = await fetch(
      `https://api.postcodes.io/postcodes/${postcode}`
    );
    if (!response.ok) throw new Error("Invalid postcode");

    const data = await response.json();
    return { lat: data.result.latitude, lon: data.result.longitude };
  } catch (error) {
    console.error("Error fetching postcode coordinates:", error);
    return null;
  }
};
