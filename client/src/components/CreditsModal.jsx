import { useCallback, useEffect, useState } from 'react'
import { X, Zap } from 'lucide-react'
import { api } from '../api/client.js'

const PACK_ORDER = ['starter', 'pro', 'power']

export default function CreditsModal({ onClose }) {
  const [credits, setCredits] = useState(null)
  const [buying, setBuying] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getCredits()
      .then((data) => setCredits(data))
      .catch((err) => setError(err.message))
  }, [])

  const purchase = useCallback(async (packId) => {
    setBuying(packId)
    setError(null)
    try {
      const data = await api.purchaseCredits(packId)
      if (data.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.checkoutUrl
      } else {
        // Fallback for stub mode (if Stripe not configured)
        setCredits(data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBuying(null)
    }
  }, [])

  const handleBackdrop = useCallback((e) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  const usedPct = credits
    ? Math.min(100, Math.round((credits.promptsUsed / credits.promptLimit) * 100))
    : 0

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Add credits">
        <div className="modal-header">
          <div className="modal-title-row">
            <Zap size={16} className="text-accent" />
            <h2 className="modal-title">Credits</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body stack">
          {credits && (
            <div className="credits-usage-block">
              <div className="credits-usage-row">
                <span className="text-muted text-sm">Monthly sessions</span>
                <span className="text-sm">{credits.promptsUsed} / {credits.promptLimit}</span>
              </div>
              <div className="credits-progress-track">
                <div className="credits-progress-fill" style={{ width: `${usedPct}%` }} />
              </div>
              {credits.creditBalance > 0 && (
                <div className="credits-balance-row">
                  <span className="text-muted text-sm">Purchased tokens remaining</span>
                  <span className="text-sm text-accent">{credits.creditBalance.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          <p className="text-muted text-sm">
            Tokens are deducted based on actual AI usage (1,000 tokens ≈ 1 credit). Purchased tokens carry over — they never expire.
          </p>

          {error && <p className="form-error">{error}</p>}

          <div className="credits-packs">
            {credits && PACK_ORDER.map((packId) => {
              const pack = credits.packs[packId]
              if (!pack) return null
              return (
                <div key={packId} className="credits-pack-card">
                  <div className="credits-pack-info">
                    <span className="credits-pack-label">{pack.label}</span>
                    <span className="credits-pack-count">{pack.credits.toLocaleString()} tokens</span>
                  </div>
                  <button
                    type="button"
                    className="button button-primary credits-pack-btn"
                    onClick={() => purchase(packId)}
                    disabled={buying !== null}
                  >
                    {buying === packId ? 'Adding…' : `$${pack.priceUsd}`}
                  </button>
                </div>
              )
            })}
          </div>

          <p className="text-muted text-sm credits-billing-note">
            Secure payment powered by Stripe. Credits are added immediately after successful payment.
          </p>
        </div>
      </div>
    </div>
  )
}
