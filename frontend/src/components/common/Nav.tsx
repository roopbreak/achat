import { Link } from 'react-router-dom'

export default function Nav() {
  return (
    <nav className="nav">
      <Link to="/" className="logo">achat-v2</Link>
      <div className="nav-links">
        <Link to="/">Home</Link>
        <Link to="/story">Story</Link>
        <Link to="/gallery">Gallery</Link>
        <Link to="/admin">Admin</Link>
      </div>
    </nav>
  )
}
