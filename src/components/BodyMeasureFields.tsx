import { useNavigate } from 'react-router-dom'
import type { BodyMeasureFormState } from './bodyMeasureForm'

export function BodyMeasureFields({
  form,
  idPrefix,
}: {
  form: BodyMeasureFormState
  idPrefix: string
}) {
  const navigate = useNavigate()
  const {
    t,
    girthUnit,
    today,
    date,
    applyDate,
    weightInput,
    setWeightInput,
    formulaSex,
    setFormulaSex,
    neck,
    setNeck,
    waist,
    setWaist,
    hip,
    setHip,
    arm,
    setArm,
    thigh,
    setThigh,
    calf,
    setCalf,
    busy,
    saveError,
    saved,
    moreOpen,
    setMoreOpen,
    rowForDate,
    profileFormula,
    sex,
    missingProfile,
    missingWeight,
    weightUnit,
    save,
    remove,
  } = form

  return (
    <>
      {missingProfile || missingWeight ? (
        <p className="muted" style={{ margin: 0 }}>
          {missingProfile ? t('body.needProfile') : t('body.needWeight')}{' '}
          <button type="button" className="btn btn--small btn--ghost" onClick={() => void navigate('/settings')}>
            {t('body.openSettings')}
          </button>
        </p>
      ) : null}

      {profileFormula === null ? (
        <div className="field">
          <label htmlFor={`${idPrefix}-formula-sex`}>{t('body.needFormulaSex')}</label>
          <select
            id={`${idPrefix}-formula-sex`}
            className="input"
            value={formulaSex}
            onChange={(e) => setFormulaSex(e.target.value as typeof formulaSex)}
          >
            <option value="">{t('settings.preferNot')}</option>
            <option value="male">{t('body.formulaMale')}</option>
            <option value="female">{t('body.formulaFemale')}</option>
          </select>
        </div>
      ) : null}

      <div className="body-comp__fields">
        <div className="field">
          <label htmlFor={`${idPrefix}-date`}>{t('common.date')}</label>
          <input
            id={`${idPrefix}-date`}
            className="input"
            type="date"
            max={today}
            value={date}
            onChange={(e) => applyDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-weight`}>{t('checkin.weight', { unit: weightUnit })}</label>
          <input
            id={`${idPrefix}-weight`}
            className="input"
            type="text"
            inputMode="decimal"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-neck`}>{t('body.neck', { unit: girthUnit })}</label>
          <input
            id={`${idPrefix}-neck`}
            className="input"
            type="text"
            inputMode="decimal"
            value={neck}
            onChange={(e) => setNeck(e.target.value)}
          />
          <small className="muted">{t('body.neckHow')}</small>
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-waist`}>{t('body.waist', { unit: girthUnit })}</label>
          <input
            id={`${idPrefix}-waist`}
            className="input"
            type="text"
            inputMode="decimal"
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
          />
          <small className="muted">
            {t(
              sex === 'female'
                ? 'body.waistHowFemale'
                : sex === 'male'
                  ? 'body.waistHowMale'
                  : 'body.waistHow',
            )}
          </small>
        </div>
        {sex === 'female' ? (
          <div className="field">
            <label htmlFor={`${idPrefix}-hips`}>{t('body.hips', { unit: girthUnit })}</label>
            <input
              id={`${idPrefix}-hips`}
              className="input"
              type="text"
              inputMode="decimal"
              value={hip}
              onChange={(e) => setHip(e.target.value)}
            />
            <small className="muted">{t('body.hipsHow')}</small>
          </div>
        ) : null}
      </div>

      <details
        className="body-comp__extras"
        open={moreOpen}
        onToggle={(event) => setMoreOpen(event.currentTarget.open)}
      >
        <summary>{t('body.more')}</summary>
        <div className="body-comp__extras-body">
          <small className="muted">{t('body.moreHint')}</small>
          {sex !== 'female' ? (
            <div className="field">
              <label htmlFor={`${idPrefix}-hips-extra`}>{t('body.hipsOptional', { unit: girthUnit })}</label>
              <input
                id={`${idPrefix}-hips-extra`}
                className="input"
                type="text"
                inputMode="decimal"
                value={hip}
                onChange={(e) => setHip(e.target.value)}
              />
              <small className="muted">{t('body.hipsHow')}</small>
            </div>
          ) : null}
          <div className="body-comp__fields">
            <div className="field">
              <label htmlFor={`${idPrefix}-arm`}>{t('body.arm', { unit: girthUnit })}</label>
              <input
                id={`${idPrefix}-arm`}
                className="input"
                type="text"
                inputMode="decimal"
                value={arm}
                onChange={(e) => setArm(e.target.value)}
              />
              <small className="muted">{t('body.armHow')}</small>
            </div>
            <div className="field">
              <label htmlFor={`${idPrefix}-thigh`}>{t('body.thigh', { unit: girthUnit })}</label>
              <input
                id={`${idPrefix}-thigh`}
                className="input"
                type="text"
                inputMode="decimal"
                value={thigh}
                onChange={(e) => setThigh(e.target.value)}
              />
              <small className="muted">{t('body.thighHow')}</small>
            </div>
            <div className="field">
              <label htmlFor={`${idPrefix}-calf`}>{t('body.calf', { unit: girthUnit })}</label>
              <input
                id={`${idPrefix}-calf`}
                className="input"
                type="text"
                inputMode="decimal"
                value={calf}
                onChange={(e) => setCalf(e.target.value)}
              />
              <small className="muted">{t('body.calfHow')}</small>
            </div>
          </div>
        </div>
      </details>

      <div className="body-comp__actions">
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
          {busy
            ? t('common.saving')
            : rowForDate
              ? t('checkin.updateBody')
              : t('checkin.saveBody')}
        </button>
        {rowForDate ? (
          <button
            type="button"
            className="btn btn--danger"
            disabled={busy}
            aria-label={t('body.delete', { date })}
            onClick={() => void remove()}
          >
            {t('common.delete')}
          </button>
        ) : null}
        {saved ? <small className="badge badge--completed">{t('common.saved')}</small> : null}
      </div>
      {saveError ? (
        <p className="field-error" role="alert">
          {saveError}
        </p>
      ) : null}
    </>
  )
}
