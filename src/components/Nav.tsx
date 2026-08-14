import { NavLink } from 'react-router-dom'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-200'
  }`

export default function Nav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        <span className="mr-4 text-lg font-semibold">🎣 Fish Tracker</span>
        <nav className="flex gap-1">
          <NavLink to="/" end className={linkClass}>
            Enter Catch Report
          </NavLink>
          <NavLink to="/upload" className={linkClass}>
            Upload Report Photo
          </NavLink>
          <NavLink to="/catch-log" className={linkClass}>
            Catch Log
          </NavLink>
        </nav>
        <div className="ml-auto text-sm text-slate-400">
          Guest info login coming in a later phase
        </div>
      </div>
    </header>
  )
}
