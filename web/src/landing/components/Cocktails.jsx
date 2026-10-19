'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap';
import { activeAuctions, recentSales } from '../data'

const Cocktails = () => {
 useGSAP(() => {
	const parallaxTimeline = gsap.timeline({
	 scrollTrigger: {
		trigger: '#cocktails',
		start: 'top 30%',
		end: 'bottom 80%',
		scrub: true,
	 }
	})
	
	parallaxTimeline
	 .from('#c-left-leaf', {
		x: -100, y: 100
	})
	 .from('#c-right-leaf', {
		x: 100, y: 100
	})
 })
 
 return (
	<section id="cocktails" className="noisy">
	 <img src="/images/cocktail-left-leaf.png" alt="l-leaf" id="c-left-leaf" />
	 <img src="/images/cocktail-right-leaf.png" alt="r-leaf" id="c-right-leaf" />
	 
	 <div className="list">
		<div className="popular">
		 <h2>Most Active Auctions:</h2>
		 
		 <ul>
			{activeAuctions.map(({ title, category, description, currentBid }) => (
			 <li key={title}>
				<div className="md:me-28">
				 <h3>{title}</h3>
				 <p>{category} | {description}</p>
				</div>
				<span>- {currentBid}</span>
			 </li>
			))}
		 </ul>
		</div>
		
		<div className="loved">
		 <h2>Recently Sold Items:</h2>
		 
		 <ul>
			{recentSales.map(({ title, category, description, finalPrice }) => (
			 <li key={title}>
				<div className="me-28">
				 <h3>{title}</h3>
				 <p>{category} | {description}</p>
				</div>
				<span>- {finalPrice}</span>
			 </li>
			))}
		 </ul>
		</div>
	 </div>
	</section>
 )
}

export default Cocktails
