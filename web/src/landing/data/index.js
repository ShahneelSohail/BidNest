const navLinks = [
  {
    id: 'Login',
    title: 'Login'
  },
  {
    id: 'Register',
    title: 'Register'
  }
]

const activeAuctions = [
  {
    title: 'Vintage Rolex Submariner',
    category: 'Watches',
    description: '1960s model in pristine condition',
    currentBid: '$12,500'
  },
  {
    title: 'Apple iPhone Pro',
    category: 'Electronics',
    description: 'Brand new, sealed box',
    currentBid: '$980'
  },
  {
    title: 'Classic Car Model Kit',
    category: 'Toys & Collectibles',
    description: 'Rare 1980s edition, unopened',
    currentBid: '$150'
  },
  {
    title: 'MacBook Pro ',
    category: 'Laptops',
    description: 'Like-new condition, 16GB RAM',
    currentBid: '$1,400'
  }
]

const recentSales = [
  {
    title: 'Spider-Man Comic ',
    category: 'Collectibles',
    description: 'Mint condition, 1963 edition',
    finalPrice: '$2,100'
  },
  {
    title: 'Dell XPS ',
    category: 'Laptops',
    description: 'Lightly used, excellent condition',
    finalPrice: '$750'
  },
  {
    title: 'Nintendo Switch OLED',
    category: 'Gaming',
    description: 'Limited edition Zelda model',
    finalPrice: '$390'
  },
  {
    title: 'Antique Typewriter',
    category: 'Antiques',
    description: 'Fully functional, early 1900s',
    finalPrice: '$320'
  }
]

const profileLists = [
  {
    imgPath: '/images/profile1.png'
  },
  {
    imgPath: '/images/profile2.png'
  },
  {
    imgPath: '/images/profile3.png'
  },
  {
    imgPath: '/images/profile4.png'
  }
]

const featureLists = [
  'Real-time bidding experience',
  'Verified sellers and listings',
  'Secure payments & transactions',
  'Track bids across all devices'
]

const whyChooseUs = [
  'Curated high-quality items',
  'Transparent bidding history',
  'Exclusive member auctions',
  'Fast and reliable shipping'
]

const storeInfo = {
  heading: 'Where to Find Us',
  address: '456, Raq Blvd. #404, Los Angeles, CA 90210',
  contact: {
    phone: '(555) 987-6543',
    email: 'hello@jsmcocktail.com'
  }
}

const openingHours = [
  { day: 'Mon–Thu', time: '11:00am – 12am' },
  { day: 'Fri', time: '11:00am – 2am' },
  { day: 'Sat', time: '9:00am – 2am' },
  { day: 'Sun', time: '9:00am – 1am' }
]

const socials = [
  {
    name: 'Instagram',
    icon: '/images/insta.png',
    url: '#'
  },
  {
    name: 'X (Twitter)',
    icon: '/images/x.png',
    url: '#'
  },
  {
    name: 'Facebook',
    icon: '/images/fb.png',
    url: '#'
  }
]

const allCocktails = [
  {
    id: 1,
    name: 'Classic Mojito',
    image: '/images/drink1.png',
    title: 'Simple Ingredients, Bold Flavor',
    description:
      'Made with tequila, lime juice, and orange liqueur, the Margarita is easy to make and full of character. Add a salted rim for the perfect drink on summer nights.'
  },
  {
    id: 2,
    name: 'Raspberry Mojito',
    image: '/images/drink2.png',
    title: 'A Zesty Classic That Never Fails',
    description:
      'The Margarita is a classic that balances tangy lime, smooth tequila, and a touch of sweetness. Shaken, frozen, or on the rocks—it’s always crisp & refreshing.'
  },
  {
    id: 3,
    name: 'Violet Breeze',
    image: '/images/drink3.png',
    title: 'Simple Ingredients, Bold Flavor',
    description:
      'Made with tequila, lime juice, and orange liqueur, the Margarita is easy to make and full of character. Add a salted rim for the perfect drink on summer nights.'
  },
  {
    id: 4,
    name: 'Curacao Mojito',
    image: '/images/drink4.png',
    title: 'Crafted With Care, Poured With Love',
    description:
      "Each cocktail is made with fresh ingredients and a passion for perfecting every pour, whether you're celebrating or simply relaxing."
  }
]

export {
  navLinks,
  profileLists,
  featureLists,
  whyChooseUs,
  openingHours,
  storeInfo,
  socials,
  allCocktails,
  activeAuctions,
  recentSales
}
