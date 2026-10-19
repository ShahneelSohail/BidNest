'use client'

import gsap from 'gsap'
import { ScrollTrigger, SplitText } from 'gsap/all'

import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Cocktails from './components/Cocktails'
import Art from './components/Art'
import TechStack from './components/TechStack'
import Testimonials from './components/Testimonials'
import Contact from './components/Contact'

gsap.registerPlugin(ScrollTrigger, SplitText)

const LandingPage = () => {
  return (
    <main>
      <Navbar />
      <Hero />
      <Cocktails />
      <Art />
      <TechStack />
      <Testimonials />
      <Contact />
    </main>
  )
}

export default LandingPage
