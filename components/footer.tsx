"use client"

import { Button } from "@/components/ui/button"
import { ShoppingCart, BarChart2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface FooterProps {
  activeView: 'checkout' | 'dashboard'
}

export function Footer({ activeView }: FooterProps) {
  const router = useRouter()

  const handleDashboardClick = () => {
    router.push('/dashboard')
  }

  const handleCheckoutClick = () => {
    router.push('/')
  }

  return (
    <footer className="bg-white shadow-lg sticky bottom-0">
      <div className="flex justify-center space-x-4 p-2 gap-2">
        <Button 
          variant={activeView === 'checkout' ? 'default' : 'ghost'} 
          onClick={handleCheckoutClick}
        >
          <ShoppingCart className="mr-2 h-4 w-4" />
          فرۆشتن
        </Button>
        <Button 
          variant={activeView === 'dashboard' ? 'default' : 'ghost'} 
          onClick={handleDashboardClick}
        >
          <BarChart2 className="mr-2 h-4 w-4" />
          دەشبۆرد
        </Button>
      </div>
    </footer>
  )
} 