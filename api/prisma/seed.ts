import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, type ItemStatus } from '@prisma/client';
import { clearSeedImages, writeSeedImage, type Glyph } from './seed-images';

const prisma = new PrismaClient();

const PASSWORD = process.env.SEED_PASSWORD ?? 'BidNest123!';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

interface SeedItem {
  slug: string;
  title: string;
  description: string;
  category: string;
  seller: string;
  glyph: Glyph;
  photo?: string;
  condition?: string;
  minBid: number;
  increment: number;
  status: ItemStatus;
  endsInHours: number;
  bids: number;
  featured?: boolean;
  paid?: boolean;
  rejectionReason?: string;
}

const USERS = [
  { username: 'admin', email: 'admin@bidnest.test', fullName: 'BidNest Admin', role: 'ADMIN' as const },
  { username: 'maya', email: 'maya@bidnest.test', fullName: 'Maya Fernandez', role: 'USER' as const },
  { username: 'omar', email: 'omar@bidnest.test', fullName: 'Omar Haddad', role: 'USER' as const },
  { username: 'lena', email: 'lena@bidnest.test', fullName: 'Lena Berg', role: 'USER' as const },
  { username: 'noah', email: 'noah@bidnest.test', fullName: 'Noah Kim', role: 'USER' as const },
  { username: 'ivy', email: 'ivy@bidnest.test', fullName: 'Ivy Okafor', role: 'USER' as const },
  { username: 'kai', email: 'kai@bidnest.test', fullName: 'Kai Tanaka', role: 'USER' as const },
];

const BIDDERS = ['noah', 'ivy', 'kai'];

const CATEGORIES: Record<string, string[]> = {
  Electronics: ['Laptops', 'Audio'],
  'Watches & Jewelry': ['Watches', 'Jewelry'],
  Collectibles: ['Coins', 'Art', 'Books', 'Music'],
  'Home & Furniture': ['Lighting', 'Seating', 'Rugs'],
  Photography: ['Cameras'],
};

const ITEMS: SeedItem[] = [
  { slug: 'rolex-submariner', photo: '1524592094714-0f0654e20314', condition: 'Excellent', title: "Vintage Rolex Submariner '68", description: 'Reference 5513 with a matching dial and bezel. Serviced in 2022 with the original box and papers. A true collector piece with honest, even patina.', category: 'Watches', seller: 'maya', glyph: 'watch', minBid: 8500, increment: 250, status: 'ACTIVE', endsInHours: 52, bids: 6, featured: true },
  { slug: 'leica-m3', photo: '1516035069371-29a1b244cc32', condition: 'Excellent', title: 'Leica M3 Rangefinder Camera', description: 'Single-stroke M3 in excellent working order, recently CLA serviced. Bright, clear viewfinder, accurate shutter speeds and a clean leather body.', category: 'Cameras', seller: 'omar', glyph: 'camera', minBid: 950, increment: 50, status: 'ACTIVE', endsInHours: 9, bids: 8, featured: true },
  { slug: 'macbook-pro-16', title: 'MacBook Pro 16-inch (M3 Max)', description: '48 GB memory and a 1 TB drive in space black. Battery cycle count under 80 and still covered by AppleCare. Comes with the original charger and box.', category: 'Laptops', seller: 'lena', glyph: 'laptop', minBid: 1800, increment: 50, status: 'ACTIVE', endsInHours: 70, bids: 5 },
  { slug: 'sony-xm5', photo: '1505740420928-5e560c06d30e', condition: 'Excellent', title: 'Sony WH-1000XM5 Headphones', description: 'Brand new and factory sealed in black. Industry-leading noise cancelling with up to 30 hours of battery life. Receipt included.', category: 'Audio', seller: 'omar', glyph: 'audio', minBid: 180, increment: 10, status: 'ACTIVE', endsInHours: 20, bids: 3 },
  { slug: 'deco-lamp', title: 'Art Deco Brass Desk Lamp', description: 'Solid brass lamp from the 1930s, professionally rewired to current standards. Warm patina and a smooth, weighted base.', category: 'Lighting', seller: 'maya', glyph: 'lamp', minBid: 85, increment: 5, status: 'ACTIVE', endsInHours: 120, bids: 2 },
  { slug: 'hobbit-first-edition', title: "'The Hobbit' Early Edition", description: 'A 1937 reprint in the original cloth binding with an intact dust jacket. Light shelf wear only, with no writing or repairs.', category: 'Books', seller: 'lena', glyph: 'book', minBid: 1200, increment: 50, status: 'ACTIVE', endsInHours: 140, bids: 4 },
  { slug: 'diamond-ring', title: '18k Gold Diamond Solitaire Ring', description: '0.9 carat round brilliant, G colour and VS2 clarity, set in 18k yellow gold. Comes with an independent grading certificate.', category: 'Jewelry', seller: 'maya', glyph: 'ring', minBid: 2200, increment: 100, status: 'ACTIVE', endsInHours: 96, bids: 3 },
  { slug: 'roman-denarii', title: 'Roman Silver Denarius Collection', description: 'Set of five silver denarii spanning three emperors, each with a clear portrait. Housed in a collector album with provenance notes.', category: 'Coins', seller: 'omar', glyph: 'coin', minBid: 340, increment: 20, status: 'ACTIVE', endsInHours: 36, bids: 7 },
  { slug: 'teak-armchair', title: 'Mid-century Teak Armchair', description: 'Danish design from the late 1950s with the original cushions. Solid teak frame, sturdy joints and a lovely warm finish.', category: 'Seating', seller: 'lena', glyph: 'chair', minBid: 260, increment: 15, status: 'ACTIVE', endsInHours: 48, bids: 0 },
  { slug: 'harbour-painting', photo: '1579783902614-a3fb3927b6a5', condition: 'Excellent', title: "Oil Painting 'Harbour at Dusk'", description: 'Original oil on canvas, signed lower right and framed in a carved gilt frame. Painted in the 1960s by a regional marine artist.', category: 'Art', seller: 'maya', glyph: 'art', minBid: 750, increment: 40, status: 'ACTIVE', endsInHours: 168, bids: 1 },
  { slug: 'fender-strat', photo: '1525201548942-d8732f6617a0', condition: 'Excellent', title: 'Fender Stratocaster 1979', description: 'Sunburst finish with the original pickups and a period-correct hard case. Plays beautifully, with a few honest dings and light fret wear.', category: 'Music', seller: 'omar', glyph: 'guitar', minBid: 2400, increment: 100, status: 'ACTIVE', endsInHours: 0.8, bids: 9, featured: true },
  { slug: 'polaroid-sx70', photo: '1526170375885-4d8ecf77b99f', condition: 'Excellent', title: 'Polaroid SX-70 Land Camera', description: 'Folding SLR in working condition, tested with fresh film. Leather in great shape and the viewfinder is clean and bright.', category: 'Cameras', seller: 'lena', glyph: 'camera', minBid: 120, increment: 5, status: 'ACTIVE', endsInHours: 12, bids: 0 },
  { slug: 'seiko-pogue', photo: '1522312346375-d1a52e2b99b3', condition: 'Excellent', title: 'Seiko 6139 Chronograph', description: 'The sought-after automatic chronograph with the yellow dial. Recently serviced, keeps excellent time and includes a leather strap.', category: 'Watches', seller: 'omar', glyph: 'watch', minBid: 600, increment: 25, status: 'SOLD', endsInHours: -30, bids: 5 },
  { slug: 'omega-speedmaster', photo: '1523170335258-f5ed11844a49', condition: 'Excellent', title: 'Omega Speedmaster Professional, 1969', description: 'Moonwatch with the original hesalite crystal and a clean, even dial. Serviced last year and supplied with its box and extract of the archives.', category: 'Watches', seller: 'maya', glyph: 'watch', minBid: 9000, increment: 250, status: 'ACTIVE', endsInHours: 0.8, bids: 9, featured: true },
  { slug: 'heuer-carrera', photo: '1547996160-81dfa63595aa', condition: 'Very good', title: 'Heuer Carrera 2447, 1966', description: 'Early Carrera chronograph with a sunburst dial, original pushers and a correct caseback. Keeps good time after a full service.', category: 'Watches', seller: 'omar', glyph: 'watch', minBid: 7200, increment: 250, status: 'ACTIVE', endsInHours: 27, bids: 6 },
  { slug: 'hasselblad-500cm', photo: '1495121553079-4c61bcce1894', condition: 'Excellent', title: 'Hasselblad 500C/M with Planar 80mm', description: 'Medium format kit with a clean Planar lens, waist-level finder and A12 back. Shutter timings tested across the range.', category: 'Cameras', seller: 'lena', glyph: 'camera', minBid: 1800, increment: 100, status: 'ACTIVE', endsInHours: 0.1, bids: 7 },
  { slug: 'leica-m6', photo: '1502920917128-1aa500764cbd', condition: 'Mint', title: 'Leica M6 TTL 0.72, black chrome', description: 'Late-production M6 TTL in black chrome with minimal wear. Meter is accurate and the rangefinder is bright and aligned.', category: 'Cameras', seller: 'omar', glyph: 'camera', minBid: 2400, increment: 50, status: 'ACTIVE', endsInHours: 5.2, bids: 5 },
  { slug: 'martin-d28', photo: '1510915361894-db8b60106cb1', condition: 'Very good', title: 'Martin D-28 dreadnought, 1971', description: 'Brazilian rosewood back and sides, original tuners and a period hard case. A few player-grade dings, plays and sounds superb.', category: 'Music', seller: 'maya', glyph: 'guitar', minBid: 5200, increment: 250, status: 'ACTIVE', endsInHours: 0.6, bids: 8 },
  { slug: 'cobalt-abstract', photo: '1541961017774-22349e4a1262', condition: 'Excellent', title: 'Abstract in cobalt and rust, 1982', description: 'Oil on canvas in its original frame, signed and dated verso. Strong colour and a confident hand, with exhibition provenance.', category: 'Art', seller: 'lena', glyph: 'art', minBid: 3000, increment: 150, status: 'ACTIVE', endsInHours: 118, bids: 4 },
  { slug: 'persian-rug', title: 'Handwoven Persian Silk Rug', description: 'Fine hand-knotted silk rug measuring 2 by 3 metres, with a deep medallion design and vibrant natural dyes. No repairs.', category: 'Rugs', seller: 'maya', glyph: 'rug', minBid: 1100, increment: 50, status: 'SOLD', endsInHours: -75, bids: 4, paid: true },
  { slug: 'typewriter-lot', title: 'Typewriter Parts Lot', description: 'Assorted keys, ribbons and spare parts for restoring vintage typewriters. Sold as is, for repairs.', category: 'Collectibles', seller: 'lena', glyph: 'box', minBid: 40, increment: 5, status: 'EXPIRED', endsInHours: -50, bids: 0 },
  { slug: 'marine-compass', title: 'Antique Brass Marine Compass', description: 'Gimballed ship compass in a fitted mahogany box, dating from around 1900. The card is crisp and the needle swings freely.', category: 'Collectibles', seller: 'omar', glyph: 'compass', minBid: 320, increment: 20, status: 'PENDING', endsInHours: 168, bids: 0 },
  { slug: 'vinyl-box-set', title: 'Limited Edition Vinyl Box Set', description: 'Numbered 12-LP remastered box set, still sealed. Includes the booklet, poster and download card.', category: 'Music', seller: 'maya', glyph: 'record', minBid: 210, increment: 10, status: 'PENDING', endsInHours: 120, bids: 0 },
  { slug: 'mystery-box', title: 'Mystery Box of Misc Items', description: 'Assorted stuff.', category: 'Collectibles', seller: 'kai', glyph: 'box', minBid: 25, increment: 2, status: 'REJECTED', endsInHours: 96, bids: 0, rejectionReason: 'The description is too vague. Please list each item and add clear photos.' },
];

const SHIPPING_COST = 85;

const createPaidOrder = async (itemId: number, winningBidId: number, price: number, paidAt: Date) => {
  const { bidderId } = await prisma.bid.findUniqueOrThrow({ where: { id: winningBidId } });
  const buyer = await prisma.user.findUniqueOrThrow({ where: { id: bidderId } });
  const address = await prisma.address.create({ data: { userId: bidderId, label: 'Home', name: buyer.fullName, line1: '221 Kent Avenue', line2: 'Apt 4', city: 'Brooklyn', region: 'NY', postal: '11249', country: 'USA' } });
  await prisma.order.create({
    data: {
      itemId,
      buyerId: bidderId,
      receiptNo: `BN-${String(itemId).padStart(6, '0')}`,
      shippingTo: { label: address.label, name: address.name, line1: address.line1, line2: address.line2, city: address.city, region: address.region, postal: address.postal, country: address.country },
      deliveryMethod: 'Insured courier',
      itemPrice: price,
      shippingCost: SHIPPING_COST,
      total: price + SHIPPING_COST,
      paymentLabel: 'Visa ending 4242',
      paidAt,
    },
  });
};

const pick = <T>(list: T[], index: number): T => list[index % list.length]!;

const resetDatabase = async () => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\_prisma%'`;
  const names = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
};

const main = async () => {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    throw new Error('Refusing to wipe a production database. Pass --force to continue.');
  }
  await resetDatabase();
  clearSeedImages();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users = new Map<string, number>();
  for (const user of USERS) {
    const created = await prisma.user.create({ data: { ...user, passwordHash } });
    users.set(user.username, created.id);
  }
  const userId = (username: string) => users.get(username)!;

  const categories = new Map<string, number>();
  for (const [parentName, children] of Object.entries(CATEGORIES)) {
    const parent = await prisma.category.create({ data: { name: parentName } });
    categories.set(parentName, parent.id);
    for (const childName of children) {
      const child = await prisma.category.create({ data: { name: childName, parentId: parent.id } });
      categories.set(childName, child.id);
    }
  }
  await prisma.category.create({ data: { name: 'Vehicles', isActive: false } });

  const now = Date.now();
  const itemIds = new Map<string, number>();
  for (const [index, seed] of ITEMS.entries()) {
    const end = now + seed.endsInHours * HOUR;
    const durationDays = seed.status === 'ACTIVE' ? 7 : 5;
    const item = await prisma.item.create({
      data: {
        sellerId: userId(seed.seller),
        categoryId: categories.get(seed.category) ?? null,
        title: seed.title,
        description: seed.description,
        minBid: seed.minBid,
        currentPrice: seed.minBid,
        bidIncrement: seed.increment,
        status: seed.status,
        featured: seed.featured ?? false,
        startDate: new Date(end - durationDays * DAY),
        endDate: new Date(end),
        condition: seed.condition ?? null,
        rejectionReason: seed.rejectionReason ?? null,
        images: { create: [{ url: seed.photo ? `https://images.unsplash.com/photo-${seed.photo}?auto=format&fit=crop&w=1200&q=80` : writeSeedImage(seed.slug, seed.glyph, seed.title), isPrimary: true }] },
      },
    });
    itemIds.set(seed.slug, item.id);

    let amount = seed.minBid;
    let lastBidId: number | null = null;
    for (let step = 0; step < seed.bids; step++) {
      const bidder = pick(BIDDERS, index + step);
      amount = step === 0 ? seed.minBid : amount + seed.increment * (step % 3 === 0 ? 2 : 1);
      const bid = await prisma.bid.create({
        data: { itemId: item.id, bidderId: userId(bidder), amount, bidTime: new Date(now - (seed.bids - step) * 3 * HOUR), isWinning: step === seed.bids - 1 },
      });
      lastBidId = bid.id;
    }
    if (lastBidId) {
      const paidAt = seed.paid ? new Date(now - 2 * DAY) : null;
      await prisma.item.update({ where: { id: item.id }, data: { currentPrice: amount, currentBidId: lastBidId, paidAt } });
      if (paidAt) await createPaidOrder(item.id, lastBidId, amount, paidAt);
    }
  }

  const watch = (username: string, slug: string) =>
    prisma.watchlist.create({ data: { userId: userId(username), itemId: itemIds.get(slug)! } });
  await Promise.all([watch('noah', 'rolex-submariner'), watch('noah', 'leica-m3'), watch('noah', 'fender-strat'), watch('ivy', 'macbook-pro-16'), watch('kai', 'diamond-ring')]);

  await prisma.notification.createMany({
    data: [
      { userId: userId('noah'), title: 'You have been outbid', message: 'Someone bid on "Leica M3 Rangefinder Camera".', link: `/auctions/${itemIds.get('leica-m3')}` },
      { userId: userId('noah'), title: 'Auction ending soon', message: '"Fender Stratocaster 1979" ends in under an hour.', link: `/auctions/${itemIds.get('fender-strat')}` },
      { userId: userId('maya'), title: 'New bid on your item', message: '"Vintage Rolex Submariner \'68" received a new bid.', link: `/auctions/${itemIds.get('rolex-submariner')}` },
      { userId: userId('omar'), title: 'Your listing is waiting for review', message: '"Antique Brass Marine Compass" has been submitted for approval.', link: '/sell', isRead: true },
    ],
  });

  await prisma.contactMessage.createMany({
    data: [
      { userId: userId('ivy'), name: 'Ivy Okafor', email: 'ivy@bidnest.test', subject: 'How does shipping work?', message: 'Hi! After I win an auction, who arranges the shipping and how long does it usually take?' },
      { userId: userId('kai'), name: 'Kai Tanaka', email: 'kai@bidnest.test', subject: 'Listing was rejected', message: 'My listing was rejected and I would like to know how to resubmit it with better details.', status: 'REPLIED', adminReply: 'Please list each item with clear photos, then submit a new listing and we will review it quickly.', repliedAt: new Date(now - DAY), repliedByUserId: userId('admin'), readAt: new Date(now - DAY) },
    ],
  });

  const answered = await prisma.contactMessage.findFirstOrThrow({ where: { status: 'REPLIED' } });
  await prisma.messageReply.create({ data: { messageId: answered.id, authorId: userId('admin'), fromAdmin: true, body: answered.adminReply!, createdAt: answered.repliedAt! } });

  const persianRug = itemIds.get('persian-rug');
  if (persianRug) {
    const winner = (await prisma.item.findUniqueOrThrow({ where: { id: persianRug }, include: { currentBid: true } })).currentBid;
    if (winner) await prisma.rating.create({ data: { raterId: winner.bidderId, ratedUserId: userId('maya'), itemId: persianRug, score: 5, comment: 'Exactly as described and packed beautifully.' } });
  }

  console.log(`Seeded ${USERS.length} users, ${categories.size} categories and ${ITEMS.length} items (${ITEMS.filter(item => item.status === 'SOLD').length} sold).`);
  console.log(`Sign in with any @bidnest.test address, for example admin@bidnest.test. The password is set in prisma/seed.ts (override with SEED_PASSWORD).`);
};

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
