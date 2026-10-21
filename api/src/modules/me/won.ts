export const wonWhere = (userId: number) => ({ status: 'SOLD' as const, currentBid: { is: { bidderId: userId } } });
