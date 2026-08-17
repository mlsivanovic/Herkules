// Routines list: reusable workout templates.
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { EmptyState, Loader } from '../components/ui'
import { IconPlus } from '../components/Icons'

export function Routines() {
  const { templates, templateItems, ready } = useStore()
  const navigate = useNavigate()

  if (!ready) return <Loader />

  return (
    <div>
      <div className="page-head">
        <h1>Routines</h1>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void navigate('/routines/new')}
        >
          <IconPlus width={18} height={18} /> New
        </button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No routines yet"
          hint="A routine is a reusable list of exercises you can schedule or start directly."
          action={
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void navigate('/routines/new')}
            >
              Create your first routine
            </button>
          }
        />
      ) : (
        <ul className="exercise-list">
          {templates.map((template) => {
            const items = templateItems.filter((i) => i.template_id === template.id)
            return (
              <li key={template.id}>
                <button
                  type="button"
                  className="card exercise-card"
                  onClick={() => void navigate(`/routines/${template.id}`)}
                >
                  <span className="row row--between">
                    <strong>{template.name}</strong>
                    <span className="badge badge--neutral">{items.length} exercises</span>
                  </span>
                  {template.notes ? <small className="muted">{template.notes}</small> : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
