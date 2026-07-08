type ParticipantInput = { share_value: string | number; is_owner_share: boolean }

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

/** Mirrors backend/shared_expense_tracker/apps/ledger/services/splits.py for live preview purposes. */
export function computeShares(price: number, splitType: string, participants: ParticipantInput[]): number[] {
  if (!participants.length || !Number.isFinite(price)) {
    return participants.map(() => 0)
  }
  const ownerIndex = participants.findIndex((participant) => participant.is_owner_share)
  const applyRemainder = (shares: number[]) => {
    const remainder = money(price - shares.reduce((sum, share) => sum + share, 0))
    if (ownerIndex >= 0) {
      shares[ownerIndex] = money(shares[ownerIndex] + remainder)
    }
    return shares
  }

  if (splitType === 'equal') {
    const base = money(price / participants.length)
    return applyRemainder(participants.map(() => base))
  }

  if (splitType === 'custom') {
    return participants.map((participant) => money(Number(participant.share_value) || 0))
  }

  if (splitType === 'percentage') {
    return applyRemainder(participants.map((participant) => money((price * (Number(participant.share_value) || 0)) / 100)))
  }

  if (splitType === 'quantity') {
    const totalQty = participants.reduce((sum, participant) => sum + (Number(participant.share_value) || 0), 0)
    if (totalQty <= 0) {
      return participants.map(() => 0)
    }
    return applyRemainder(participants.map((participant) => money((price * (Number(participant.share_value) || 0)) / totalQty)))
  }

  return participants.map(() => 0)
}
