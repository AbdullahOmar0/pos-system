"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Trash2, ShoppingCart, BarChart2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Image from 'next/image'

interface MenuItem {
  id: string
  product_name: string
  category: string
  product_img_path: string
  product_price: number
  product_stock: number
}

interface OrderItem {
  id: string
  product_name: string
  product_price: number
  quantity: number
}

interface Banknote {
  value: number
  image: string
}


const banknotes: Banknote[] = [
  { value: 250, image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-txP3Fkrgyzh5n9R7tbvzMpeTYCXehw.png' },
  { value: 1000, image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-10aQeIuJSRVn7DTn7vLRV41OpgEtjo.png' },
  { value: 5000, image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-aKXZp9gchIea22T6EH91v8ZE5jdWQ8.png' },
  { value: 10000, image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-P37JZaBcgOMqjv2WVVx33aQDdDU3Zl.png' },
  { value: 25000, image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-UZiW3D8y7NCaZ3Iq0SR9NXbFUH5WLs.png' },
  { value: 50000, image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-dsTLl5h5KCYZvMc1KeUx5UgaZv25Wg.png' },
]

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD' }).format(amount)
}

export function PosSystem({ initialProducts }: { initialProducts: MenuItem[] }) {
  const router = useRouter()
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialProducts)
  const [order, setOrder] = useState<OrderItem[]>([])
  const [activeCategory, setActiveCategory] = useState('All')
  const [categories, setCategories] = useState<string[]>(['All'])
  const [searchTerm, setSearchTerm] = useState('')
  const [isBatchPaymentOpen, setIsBatchPaymentOpen] = useState(false)
  const [amountReceived, setAmountReceived] = useState(0)
  const [change, setChange] = useState(0)
  const [activeView, setActiveView] = useState<'checkout' | 'dashboard'>('checkout')

  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        console.log('Change received!', payload)
        updateProducts()
      })
      .subscribe()

    fetchCategories()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('category')
      .select('category')

    if (error) {
      console.error("Error fetching categories:", error)
    } else {
      const categoryList = data.map(item => item.category)
      setCategories(['All', ...categoryList])
    }
  }

  const updateProducts = async () => {
    const { data: products, error } = await supabase.from("products").select()
    if (error) {
      console.error("Error fetching products:", error)
    } else {
      setMenuItems(products)
    }
  }

  const addToOrder = (item: MenuItem) => {
    setOrder(prevOrder => {
      const existingItem = prevOrder.find(orderItem => orderItem.id === item.id)
      if (existingItem) {
        return prevOrder.map(orderItem =>
          orderItem.id === item.id
            ? { ...orderItem, quantity: orderItem.quantity + 1 }
            : orderItem
        )
      }
      return [...prevOrder, { id: item.id, product_name: item.product_name, product_price: item.product_price, quantity: 1 }]
    })
  }

  const removeFromOrder = (itemId: string) => {
    setOrder(prevOrder => prevOrder.filter(item => item.id !== itemId))
  }

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      removeFromOrder(itemId)
    } else {
      setOrder(prevOrder =>
        prevOrder.map(item =>
          item.id === itemId
            ? { ...item, quantity: newQuantity }
            : item
        )
      )
    }
  }

  const filteredItems = menuItems
    .filter(item => activeCategory === 'All' || item.category === activeCategory)
    .filter(item => item.product_name.toLowerCase().includes(searchTerm.toLowerCase()))

  const total = order.reduce((sum, item) => sum + item.product_price * item.quantity, 0)

  const handleBatchPayment = () => {
    setIsBatchPaymentOpen(true)
    setAmountReceived(0)
    setChange(0)
  }

  const handleBanknoteClick = (value: number) => {
    setAmountReceived(prev => prev + value)
    setChange(amountReceived + value - total)
  }

  const handleCompleteBatchPayment = async () => {
    // Create a new sale in the sales table
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        sale_date: new Date().toISOString(),
        total_amount: total,
        user_id: (await supabase.auth.getUser()).data.user?.id // Assuming the user is logged in
      })
      .select()

    if (saleError) {
      console.error("Error creating sale:", saleError)
      return
    }

    const saleId = saleData[0].id

    // Add items to the sales_items table
    for (const item of order) {
      const { error: itemError } = await supabase
        .from('sales_items')
        .insert({
          sale_id: saleId,
          product_id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.product_price
        })

      if (itemError) {
        console.error("Error adding sale item:", itemError)
      }

      // Update product stock
      const { error: stockError } = await supabase
        .from('products')
        .update({ product_stock: menuItems.find(menuItem => menuItem.id === item.id)!.product_stock - item.quantity })
        .eq('id', item.id)

      if (stockError) {
        console.error("Error updating stock:", stockError)
      }
    }

    // Update cash drawer
    //setCashDrawer(prevDrawer => ({
    //  balance: prevDrawer.balance + total,
    //  transactions: [
    //    ...prevDrawer.transactions,
    //    { type: 'in', amount: total, description: 'Sale', timestamp: new Date() }
    //  ]
    //}))

    // Reset order and close dialog
    setIsBatchPaymentOpen(false)
    setOrder([])
    setAmountReceived(0)
    setChange(0)

    // Refresh products
    updateProducts()
  }


  const handleDashboardClick = () => {
    router.push('/dashboard')
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-white shadow-sm p-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-4 overflow-x-auto">
            {categories.map((category) => (
              <Button
                key={category}
                variant={activeCategory === category ? 'default' : 'ghost'}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="search"
                placeholder="Search..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 bg-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredItems.map(item => (
              <Card key={item.id} className="overflow-hidden cursor-pointer" onClick={() => addToOrder(item)}>
                <CardContent className="p-0">
                  <Image 
                    src={item.product_img_path.startsWith('http') 
                      ? item.product_img_path 
                      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product_images/${item.product_img_path}`}
                    alt={item.product_name}
                    width={300}
                    height={200}
                    className="w-full h-32 object-cover"
                  />
                  <div className="p-2">
                    <h3 className="font-semibold">{item.product_name}</h3>
                    <div>
                      <p>{formatCurrency(item.product_price)}</p>
                      <p>Stock: {item.product_stock}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>

        <aside className="w-80 bg-white shadow-xl overflow-hidden flex flex-col">
          <div className="p-4  font-semibold text-lg">Current Order</div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {order.map(item => (
                <div  key={item.id} className="flex justify-between items-center">
                  <span>{item.product_name}</span>
                  <div className="flex items-center space-x-2">
                    <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</Button>
                    <span>{item.quantity}</span>
                    <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</Button>
                    <Button size="sm" variant="ghost" onClick={() => removeFromOrder(item.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-4 border-t">
            <div className="flex justify-between mb-2">
              <span>Subtotal</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <Button className="w-full mb-2" onClick={handleBatchPayment} disabled={order.length === 0}>
              Batch Payment
            </Button>
          </div>
        </aside>
      </div>

      <footer className="bg-white shadow-lg">
        <div className="flex justify-center space-x-4 p-2">
          <Button variant={activeView === 'checkout' ?   'default' : 'ghost'} onClick={() => setActiveView('checkout')}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Checkout
          </Button>
          <Button variant={activeView === 'dashboard' ? 'default' : 'ghost'} onClick={handleDashboardClick}>
            <BarChart2 className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </div>
      </footer>

      <Dialog open={isBatchPaymentOpen} onOpenChange={setIsBatchPaymentOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Batch Payment</DialogTitle>
            <DialogDescription>Select the banknotes received from the customer.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between">
              <Label>Total Due:</Label>
              <span className="font-bold">{formatCurrency(total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {banknotes.map((banknote) => (
                <Button
                  key={banknote.value}
                  onClick={() => handleBanknoteClick(banknote.value)}
                  className="p-0 h-auto"
                >
                  <img
                    src={banknote.image}
                    alt={`${banknote.value} Dinar note`}
                    className="w-full h-auto object-cover rounded-md"
                  />
                </Button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Label>Amount Received:</Label>
              <span className="font-bold">{formatCurrency(amountReceived)}</span>
            </div>
            <div className="flex items-center justify-between">
              <Label>Change:</Label>
              <span className={`font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(change)}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsBatchPaymentOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleCompleteBatchPayment} disabled={amountReceived < total}>
              Complete Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}