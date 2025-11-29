import { Link } from "react-router-dom";
import "../../../public/css/hero.css";

const Hero = () => {
  return (
    <section className="hero">
      <div className="hero-content">
        <h1>Discover & Organise Islamic Events Near You</h1>
        <p>
          Connect with your community and strengthen your deen through inspiring
          gatherings.
        </p>
        <div className="hero-buttons">
          <Link to="/events" className="btn primary">
            Browse Events
          </Link>
          <Link to="/create" className="btn secondary">
            Host an Event
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Hero;
