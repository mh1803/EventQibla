import { Link } from "react-router-dom";
import "../../../public/css/categories.css";

const categories = [
  { name: "Islamic Lectures", query: "lectures" },
  { name: "Charity", query: "charity" },
  { name: "Study Groups", query: "study" },
  { name: "Social", query: "social" },
];

const Categories = () => {
  return (
    <section className="categories">
      <h2>Explore Events by Category</h2>
      <div className="category-grid">
        {categories.map((category) => (
          <Link
            key={category.name}
            to={`/events?category=${category.query}`}
            className="category-tile"
          >
            {category.name}
          </Link>
        ))}
      </div>
    </section>
  );
};

export default Categories;
