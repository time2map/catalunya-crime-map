export default function LogoBar() {
  return (
    <div className="logo-bar">
      <a
        href="https://time2map.com"
        target="_blank"
        rel="noopener noreferrer"
        title="Visit time2map.com"
        className="logo-link"
      >
        <img src={`${import.meta.env.BASE_URL}time2map-logo.svg`} alt="time2map" className="logo-img" />
      </a>
    </div>
  );
}
