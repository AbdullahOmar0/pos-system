"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Trash2, ShoppingCart, BarChart2, ArrowLeft, Plus, Minus, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Toaster, toast } from 'sonner'

import Image from 'next/image'
import { v4 as uuidv4 } from 'uuid'
import { OfflineMode, addOfflineTransaction, OfflineTransaction, updateProductStock, getProductFromIndexedDB } from '@/utils/offline-mode'

interface MenuItem {
  id: string
  product_name: string
  category: string
  product_img_path: string
  product_price: number
  product_stock: number
  expiry_date: string
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

interface InventoryItem {
  product_id: string
  quantity: number
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

const isProductAvailable = (item: MenuItem) => {
  const today = new Date()
  const expirationDate = new Date(item.expiry_date)
  return item.product_stock > 0 && expirationDate > today
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
  const [selectedQuantity, setSelectedQuantity] = useState('')
  const [lastCompletedSale, setLastCompletedSale] = useState<{ amountReceived: number; change: number } | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null)
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false)

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
    fetchInventory()

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

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('product_id, quantity')

    if (error) {
      console.error("Error fetching inventory:", error)
    } else {
      setInventory(data)
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

  const addToOrder = async (item: MenuItem) => {
    if (!isProductAvailable(item)) {
      console.log("Product is not available for sale")
      return
    }

    const quantity = parseInt(selectedQuantity) || 1
    if (order.length === 0) {
      setAmountReceived(0);
      setChange(0);
    }

    const newOrder = [...order]
    const existingItem = newOrder.find(orderItem => orderItem.id === item.id)
    if (existingItem) {
      existingItem.quantity += quantity
    } else {
      newOrder.push({ id: item.id, product_name: item.product_name, product_price: item.product_price, quantity: quantity })
    }

    setOrder(newOrder)
    setSelectedQuantity('')
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
    .sort((a, b) => a.product_name.localeCompare(b.product_name))

  const total = order.reduce((sum, item) => sum + item.product_price * item.quantity, 0)

  const handleBatchPayment = () => {
    setIsBatchPaymentOpen(true)
    setAmountReceived(0)
    setChange(0)
  }

  const handleBanknoteClick = (value: number) => {
    const newAmountReceived = amountReceived + value;
    setAmountReceived(newAmountReceived);
    setChange(newAmountReceived - total);
  }

  const handleCompleteBatchPayment = async () => {
    if (amountReceived < total) {
      console.error("Insufficient amount received");
      return;
    }

    const offlineTransaction: OfflineTransaction = {
      id: uuidv4(),
      items: await Promise.all(order.map(async (item) => {
        const product = await getProductFromIndexedDB(item.id);
        return {
          id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.product_price,
          currentStock: product ? product.product_stock - item.quantity : 0
        };
      })),
      total: total,
      amountReceived: amountReceived,
      change: change,
      timestamp: Date.now()
    };

    if (navigator.onLine) {
      try {
        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .insert({
            sale_date: new Date().toISOString(),
            total_amount: total,
            amount_received: Math.round(amountReceived),
            change: Math.round(change),
            user_id: (await supabase.auth.getUser()).data.user?.id
          })
          .select()

        if (saleError) {
          console.error("Error creating sale:", saleError)
          await addOfflineTransaction(offlineTransaction)
          console.log("Transaction saved offline due to error")
        } else {
          const saleId = saleData[0].id

          for (const item of offlineTransaction.items) {
            const { error: itemError } = await supabase
              .from('sales_items')
              .insert({
                sale_id: saleId,
                product_id: item.id,
                product_name: item.product_name,
                quantity: item.quantity,
                price: item.price
              })

            if (itemError) {
              console.error("Error adding sale item:", itemError)
            }

            const { error: stockError } = await supabase
              .from('products')
              .update({ product_stock: item.currentStock })
              .eq('id', item.id)

            if (stockError) {
              console.error("Error updating stock:", stockError)
            }
          }

          console.log("Online transaction completed successfully")
        }
      } catch (error) {
        console.error("Error processing online transaction:", error)
        await addOfflineTransaction(offlineTransaction)
        console.log("Transaction saved offline due to error")
      }
    } else {
      await addOfflineTransaction(offlineTransaction)
      console.log("Offline transaction saved successfully")
    }

    // Update local stock after successful transaction
    for (const item of offlineTransaction.items) {
      await updateProductStock(item.id, -item.quantity)
    }

    setLastCompletedSale({ amountReceived: amountReceived, change: change });
    setIsBatchPaymentOpen(false);
    setOrder([]);
    setAmountReceived(0);
    setChange(0);
    updateProducts();
  }

  const handleDashboardClick = () => {
    router.push('/dashboard')
  }

  const handleKeypadClick = (value: string) => {
    if (value === 'backspace') {
      setSelectedQuantity(prev => prev.slice(0, -1))
    } else {
      setSelectedQuantity(prev => prev + value)
    }
  }

  const handleProductClick = (item: MenuItem) => {
    setSelectedProduct(item)
    setIsProductDialogOpen(true)
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
        <OfflineMode />
      </header>
      <Toaster position="bottom-right" />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 bg-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredItems.map(item => (
              <Card 
                key={item.id}
                className={`overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200 ${
                  !isProductAvailable(item) ? 'opacity-50' : ''
                }`} 
                onClick={() => addToOrder(item)}
              >
                <CardContent className="p-0 relative">
                  <Image 
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product_images/${item.product_img_path}`}
                    alt={item.product_name}
                    width={300}
                    height={200}
                    className="w-full h-32 object-cover"
                  />
                  <div className="p-2">
                    <h3 className="font-semibold text-sm">{item.product_name}</h3>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-sm font-bold text-green-600">{formatCurrency(item.product_price)}</p>
                      <p className="text-xs text-gray-500">Stock: {item.product_stock}</p>
                    </div>
                  </div>
                  {!isProductAvailable(item) && (
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 rounded-full p-0.5 h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProductClick(item);
                      }}
                    >
                      <AlertCircle className="h-4 w-4"   />
                      <span className="sr-only">Product nicht verfügbar</span>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </main>

        <aside className="w-80 bg-white shadow-xl overflow-hidden flex flex-col">
          <div className="p-4 font-semibold text-lg border-b">Aktuelle Bestellung</div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {order.map(item => (
                <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                  <div className="flex flex-col">
                    <span className="font-medium">{item.product_name}</span>
                    <span className="text-sm text-gray-500">{formatCurrency(item.product_price)} pro Stück</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => removeFromOrder(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-4 border-t">
            <div className="flex justify-between mb-4">
              <div className="text-center">
                <div>Gegeben</div>
                <div>{formatCurrency(lastCompletedSale ? lastCompletedSale.amountReceived : 0)}</div>
              </div>
              <div className="text-center">
                <div>Rückgeld</div>
                <div>{formatCurrency(lastCompletedSale ? lastCompletedSale.change : 0)}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((num) => (
                <Button key={num} variant="outline" onClick={() => handleKeypadClick(num)} className="h-12 text-xl font-semibold">
                  {num}
                </Button>
              ))}
              <Button variant="outline" onClick={() => handleKeypadClick('backspace')} className="h-12">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </div>
            <div className="bg-gray-100 p-3 rounded-lg mb-4 flex justify-between items-center">
              <span className="text-lg font-semibold">Zwischensumme:</span>
              <span className="text-xl font-bold">{formatCurrency(total)}</span>
            </div>
            <Button className="w-full h-12 text-lg bg-black hover:bg-gray-800 text-white" onClick={handleBatchPayment} disabled={order.length === 0}>
              Zur Zahlung
            </Button>
          </div>
        </aside>
      </div>

      <footer className="bg-white shadow-lg">
        <div className="flex justify-center space-x-4 p-2">
          <Button variant={activeView === 'checkout' ? 'default' : 'ghost'} onClick={() => setActiveView('checkout')}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Kasse
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
            <DialogTitle>Batchzahlung</DialogTitle>
            <DialogDescription>Wählen Sie die vom Kunden erhaltenen Banknoten aus.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between">
              <Label>Zu zahlender Betrag:</Label>
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
                    alt={`${banknote.value} Dinar Schein`}
                    className="w-full h-auto object-cover rounded-md"
                  />
                </Button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Label>Erhaltener Betrag:</Label>
              <span className="font-bold">{formatCurrency(amountReceived)}</span>
            </div>
            <div className="flex items-center justify-between">
              <Label>Rückgeld:</Label>
              <span className={`font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(change)}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              setIsBatchPaymentOpen(false);
              setAmountReceived(0);
              setChange(0);
            }} variant="outline">
              Abbrechen
            </Button>
            <Button onClick={handleCompleteBatchPayment} disabled={amountReceived < total}>
              Transaktion abschließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Produktdetails</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="grid gap-4 py-4">
              <Image
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product_images/${selectedProduct.product_img_path}`}
                alt={selectedProduct.product_name}
                width={300}
                height={200}
                className="w-full h-48 object-cover rounded-md"
              />
              <h3 className="text-lg font-semibold">{selectedProduct.product_name}</h3>
              <p>
                Grund: {selectedProduct.product_stock === 0 ? 'Ausverkauft' : 'Abgelaufen'}
              </p>
              <p>
                Lagerbestand: {inventory.find(item => item.product_id === selectedProduct.id)?.quantity || 0}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsProductDialogOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}