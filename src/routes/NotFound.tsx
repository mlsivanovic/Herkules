import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="state" style={{ minHeight: '60vh' }}>
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link to="/" className="btn btn--primary">
        Go to Today
      </Link>
    </div>
  )
}
