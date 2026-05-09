import { Link } from 'react-router-dom'

export default function Nav() {
  return (
    <nav className="nav">
      <Link to="/" className="logo">AChat</Link>
      <div className="nav-links">
        <Link to="/">Home</Link>
        <Link to="/admin">Admin</Link>
      </div>
    </nav>
  )
}
