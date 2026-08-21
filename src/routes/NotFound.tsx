import { Link } from 'react-router-dom'
import { useT } from '../lib/i18n'

export function NotFound() {
  const { t } = useT()
  return (
    <div className="state" style={{ minHeight: '60vh' }}>
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.body')}</p>
      <Link to="/" className="btn btn--primary">
        {t('notFound.goToday')}
      </Link>
    </div>
  )
}
