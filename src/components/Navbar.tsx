const menuItems = ['File', 'View', 'Tools', 'Help'];

function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-logo">ZSF3</div>
      <nav className="navbar-menu" aria-label="Primary">
        {menuItems.map((item) => (
          <button key={item} type="button">
            {item}
          </button>
        ))}
      </nav>
    </header>
  );
}

export default Navbar;
