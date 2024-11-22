"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Trash2, ShoppingCart, BarChart2, ArrowLeft, Plus, Minus, AlertCircle, Printer } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Toaster, toast } from 'sonner'

import Image from 'next/image'
import { v4 as uuidv4 } from 'uuid'
import { OfflineMode, addOfflineTransaction, OfflineTransaction, updateProductStock, getProductFromIndexedDB } from '@/utils/offline-mode'
import { Footer } from "@/components/footer"
import { useTranslation } from '@/hooks/useTranslation';
import { PDFDownloadLink, Document, Page } from '@react-pdf/renderer'
import Receipt from '@/components/Receipt'

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
  { value: 250, image: '/banknotes/250.png' },
  { value: 1000, image: '/banknotes/1000.png' },
  { value: 5000, image: '/banknotes/5000.png' },
  { value: 10000, image: '/banknotes/10000.png' },
  { value: 25000, image: '/banknotes/25000.png' },
  { value: 50000, image: '/banknotes/50000.png' },
]

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD' }).format(amount)
}

const isProductAvailable = (item: MenuItem) => {
  const today = new Date()
  const expirationDate = new Date(item.expiry_date)
  return item.product_stock > 0 && expirationDate > today
}

interface BlobProviderParams {
  blob: Blob | null;
  url: string | null;
  loading: boolean;
  error: Error | null;
}

const getProductAvailabilityStatus = (item: MenuItem) => {
  const today = new Date();
  const expiryDate = new Date(item.expiry_date);
  
  if (expiryDate < today) {
    return 'expired';
  }
  if (item.product_stock <= 0) {
    return 'outOfStock';
  }
  return 'available';
};

const formatExpiryDate = (dateString: string, t: (key: string, options?: any) => string) => {
  const date = new Date(dateString);
  const today = new Date();
  const expiryDate = new Date(date.toDateString());
  const todayDate = new Date(today.toDateString());
  
  const diffTime = expiryDate.getTime() - todayDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const formattedDate = `AP ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  let statusText = '';
  let statusClass = '';
  
  if (diffDays < 0) {
    statusText = t('pos.productDialog.expiredAgo', { days: Math.abs(diffDays) });
    statusClass = 'text-red-600';
  } else if (diffDays === 0) {
    statusText = t('pos.productDialog.expirestoday');
    statusClass = 'text-orange-600';
  } else if (diffDays <= 7) {
    statusText = t('pos.productDialog.expiresSoon', { days: diffDays });
    statusClass = 'text-yellow-600';
  } else {
    statusText = t('pos.productDialog.expiresIn', { days: diffDays });
    statusClass = 'text-green-600';
  }

  return { formattedDate, statusText, statusClass };
};

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
  const [lastCompletedOrder, setLastCompletedOrder] = useState<OrderItem[]>([])

  const supabase = createClient()
  const { t } = useTranslation();

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
    const today = new Date();
    const expiryDate = new Date(item.expiry_date);
    
    if (expiryDate < today) {
        toast.error(t('pos.productDialog.expired'));
        return;
    }

    if (!isProductAvailable(item)) {
        toast.error(t('pos.productDialog.outOfStock'));
        return;
    }

    const quantity = parseInt(selectedQuantity) || 1;
    if (order.length === 0) {
        setAmountReceived(0);
        setChange(0);
    }

    const newOrder = [...order];
    const existingItem = newOrder.find(orderItem => orderItem.id === item.id);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        newOrder.push({ 
            id: item.id, 
            product_name: item.product_name, 
            product_price: item.product_price, 
            quantity: quantity 
        });
    }

    setOrder(newOrder);
    setSelectedQuantity('');
  };

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
      toast.error(t('pos.batchPayment.insufficientAmount'));
      return;
    }

    const offlineTransaction: OfflineTransaction = {
      id: uuidv4(),
      items: await Promise.all(order.map(async (item) => {
        const product = await getProductFromIndexedDB(item.id);
        const currentStock = product ? product.product_stock : 0;
        const newStock = Math.max(0, currentStock - item.quantity);
        
        return {
          id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.product_price,
          currentStock: newStock
        };
      })),
      total: total,
      amountReceived: amountReceived,
      change: change,
      timestamp: Date.now()
    };

    try {
      if (!navigator.onLine) {
        // Wenn offline, speichere die Transaktion in IndexedDB
        await addOfflineTransaction(offlineTransaction);
        toast.success(t('pos.batchPayment.offlineTransactionSaved'));
      } else {
        // Online-Transaktion verarbeiten
        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .insert({
            sale_date: new Date().toISOString(),
            total_amount: total,
            amount_received: Math.round(amountReceived),
            change: Math.round(change),
            user_id: (await supabase.auth.getUser()).data.user?.id
          })
          .select();

        if (saleError) {
          throw saleError;
        }

        const saleId = saleData[0].id;

        // Verarbeite jedes Produkt in der Bestellung
        for (const item of offlineTransaction.items) {
          try {
            // Aktualisiere den Lagerbestand
            const { error: stockError } = await supabase
              .from('products')
              .update({ product_stock: item.currentStock })
              .eq('id', item.id);

            if (stockError) throw stockError;

            // Füge Verkaufsposition hinzu
            const { error: itemError } = await supabase
              .from('sales_items')
              .insert({
                sale_id: saleId,
                product_id: item.id,
                product_name: item.product_name,
                quantity: item.quantity,
                price: item.price
              });

            if (itemError) throw itemError;
          } catch (error) {
            console.error("Error processing item:", error);
            // Speichere die Transaktion offline, wenn ein Fehler auftritt
            await addOfflineTransaction(offlineTransaction);
            toast.error(t('pos.batchPayment.errorSavingOffline'));
            return;
          }
        }

        toast.success(t('pos.batchPayment.transactionComplete'));
      }

      // Aktualisiere den lokalen Lagerbestand
      for (const item of offlineTransaction.items) {
        await updateProductStock(item.id, -item.quantity);
      }

      // Setze den Bestellstatus zurck
      setLastCompletedSale({ amountReceived: amountReceived, change: change });
      setLastCompletedOrder([...order]);
      setIsBatchPaymentOpen(false);
      setOrder([]);
      setAmountReceived(0);
      setChange(0);
      updateProducts();

    } catch (error) {
      console.error("Transaction error:", error);
      toast.error(t('pos.batchPayment.transactionError'));
      
      // Versuche die Transaktion offline zu speichern
      try {
        await addOfflineTransaction(offlineTransaction);
        toast.success(t('pos.batchPayment.savedOffline'));
      } catch (offlineError) {
        console.error("Offline save error:", offlineError);
        toast.error(t('pos.batchPayment.offlineSaveError'));
      }
    }
  };

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
    <>
      <OfflineMode />
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
                  placeholder={t('common.search')}
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
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
                      className="w-full h-32 object-contain"
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
                        <AlertCircle className="h-4 w-4" />
                        <span className="sr-only">{t('pos.productDialog.productNotAvailable')}</span>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </main>

          <aside className="w-96 bg-white shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 bg-gray-50 border-b">
              <h2 className="text-xl font-bold">{t('pos.currentOrder')}</h2>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {order.map(item => (
                  <div 
                    key={item.id} 
                    className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="p-3">
                      {/* Produktname und Entfernen-Button */}
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-900">{item.product_name}</h3>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-gray-400 hover:text-red-600"
                          onClick={() => removeFromOrder(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Preis und Menge */}
                      <div className="flex justify-between items-center">
                        <p className="text-green-600 font-semibold">
                          {formatCurrency(item.product_price)}
                          <span className="text-gray-400 text-sm ml-1">{t('pos.perUnit')}</span>
                        </p>
                        
                        <div className="flex items-center space-x-1 bg-gray-50 rounded-lg p-1">
                          <Button 
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button 
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Gesamtpreis für diesen Artikel */}
                      <div className="mt-2 text-right text-sm text-gray-500">
                        {t('pos.subtotal')}: {formatCurrency(item.product_price * item.quantity)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {order.length === 0 && (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">{t('pos.emptyOrder')}</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Unterer Bereich mit Numpad und Zahlungsinformationen */}
            <div className="border-t bg-gray-50 p-4">
              {/* Letzte Transaktion */}
              {lastCompletedSale && (
                <div className="mb-4 bg-green-50 rounded-lg p-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{t('pos.received')}:</span>
                    <span className="font-medium">{formatCurrency(lastCompletedSale.amountReceived)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('pos.change')}:</span>
                    <span className="font-medium">{formatCurrency(lastCompletedSale.change)}</span>
                  </div>
                </div>
              )}

              {/* Numpad Grid */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <Button
                    key={num}
                    variant="outline"
                    onClick={() => handleKeypadClick(num)}
                    className="h-12 text-xl font-medium hover:bg-gray-100"
                  >
                    {num}
                  </Button>
                ))}
                {/* Kassenbon-Button */}
                {lastCompletedOrder.length > 0 && lastCompletedSale && (
                  <PDFDownloadLink
                    document={<Receipt order={lastCompletedOrder} total={lastCompletedOrder.reduce((sum, item) => sum + item.product_price * item.quantity, 0)} amountReceived={lastCompletedSale.amountReceived} change={lastCompletedSale.change} currentTime={''} currentDate={''} />}
                    fileName="receipt.pdf"
                  >
                  <Button 
                      variant="outline" 
                      className="h-12 w-full flex items-center justify-center hover:bg-gray-100"
                      disabled={false}
                    >
                      <Printer className="h-5 w-5" />
                    </Button>
                  </PDFDownloadLink>
                )}
                <Button
                  variant="outline"
                  onClick={() => handleKeypadClick('0')}
                  className="h-12 text-xl font-medium hover:bg-gray-100"
                >
                  0
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleKeypadClick('backspace')}
                  className="h-12 hover:bg-gray-100"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </div>

              {/* Gesamtsumme */}
              <div className="bg-gray-100 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">{t('pos.subtotal')}:</span>
                  <span className="text-2xl font-bold text-green-600">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Zahlungs-Button */}
              <Button
                className="w-full h-14 text-lg font-medium bg-black hover:bg-gray-800 text-white"
                onClick={handleBatchPayment}
                disabled={order.length === 0}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                {t('pos.payment')}
              </Button>
            </div>
          </aside>
        </div>

        <Footer activeView={activeView} />

        <Dialog open={isBatchPaymentOpen} onOpenChange={setIsBatchPaymentOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">{t('pos.batchPayment.title')}</DialogTitle>
              <DialogDescription className="text-gray-500">
                {t('pos.batchPayment.description')}
              </DialogDescription>
            </DialogHeader>
            
            {/* Hauptbereich mit Grid-Layout */}
            <div className="grid grid-cols-2 gap-6 py-6">
              {/* Linke Spalte - Zahlungsübersicht */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">{t('pos.batchPayment.amountDue')}</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(total)}</p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">{t('pos.batchPayment.amountReceived')}</p>
                  <p className="text-3xl font-bold text-blue-600">{formatCurrency(amountReceived)}</p>
                </div>
                
                <div className={`bg-gray-50 p-4 rounded-lg ${change >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-sm text-gray-500">{t('pos.change')}</p>
                  <p className={`text-3xl font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(change)}
                  </p>
                </div>
              </div>

              {/* Rechte Spalte - Geldscheine */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {banknotes.map((banknote) => (
                    <Button
                      key={banknote.value}
                      onClick={() => handleBanknoteClick(banknote.value)}
                      className="p-2 h-auto hover:scale-105 transition-transform duration-200"
                      variant="outline"
                    >
                      <div className="relative w-full aspect-[2/1]">
                        <Image
                          src={banknote.image}
                          alt={`${formatCurrency(banknote.value)}`}
                          width={200}
                          height={100}
                          className="object-contain rounded-md"
                        />
                      </div>
                    </Button>
                  ))}
                </div>
                
                {/* Schnellauswahl für häufige Beträge */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setAmountReceived(total)}
                    className="text-sm"
                  >
                    {t('pos.batchPayment.exact')}
                  </Button>
                
                  <Button
                    variant="outline"
                    onClick={() => setAmountReceived(0)}
                    className="text-sm"
                  >
                    {t('pos.batchPayment.clear')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Status-Nachricht */}
            {amountReceived < total && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                  <p className="mr-1.5 text-sm text-yellow-700">
                    {t('pos.batchPayment.insufficientAmount')}
                  </p>
                </div>
              </div>
            )}

            {/* Footer mit Aktionen */}
            <DialogFooter className="space-x-4 gap-2">
            <Button
                onClick={handleCompleteBatchPayment}
                disabled={amountReceived < total}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {t('pos.batchPayment.completeTransaction')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsBatchPaymentOpen(false);
                  setAmountReceived(0);
                  setChange(0);
                }}
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">{t('pos.productDialog.title')}</DialogTitle>
            </DialogHeader>
            {selectedProduct && (
              <div className="space-y-6">
                {/* Produktbild mit Overlay für abgelaufene/nicht verfügbare Produkte */}
                <div className="relative rounded-lg overflow-hidden">
                  <Image
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product_images/${selectedProduct.product_img_path}`}
                    alt={selectedProduct.product_name}
                    width={500}
                    height={300}
                    className="w-full h-64 object-contain"
                  />
                  {getProductAvailabilityStatus(selectedProduct) !== 'available' && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <div className="bg-white bg-opacity-90 px-4 py-2 rounded-full">
                        <p className="text-red-600 font-semibold flex items-center">
                          <AlertCircle className="w-5 h-5 mr-2" />
                          {getProductAvailabilityStatus(selectedProduct) === 'expired' 
                            ? t('pos.productDialog.expired')
                            : t('pos.productDialog.outOfStock')
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Produktdetails */}
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-bold">{selectedProduct.product_name}</h3>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600 mb-1">
                        {formatCurrency(selectedProduct.product_price)}
                      </p>
                      <p className="text-sm text-gray-500">{t('pos.perUnit')}</p>
                    </div>
                  </div>

                  {/* Status-Karte */}
                  {getProductAvailabilityStatus(selectedProduct) !== 'available' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div className="ml-3">
                          <h3 className="mr-1.5 text-sm font-medium text-red-800">
                            {t('pos.productDialog.reason')}
                          </h3>
                          <p className="mt-1 text-sm text-red-700">
                            {getProductAvailabilityStatus(selectedProduct) === 'expired' 
                              ? t('pos.productDialog.expired')
                              : t('pos.productDialog.outOfStock')
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Info-Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500">{t('pos.stock')}</p>
                      <p className="text-lg font-semibold">
                        {selectedProduct.product_stock}
                        <span className="mr-1 text-sm text-gray-500 ml-1">{t('pos.units')}</span>
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500">{t('pos.inventory')}</p>
                      <p className="text-lg font-semibold">
                        {inventory.find(item => item.product_id === selectedProduct.id)?.quantity || 0}
                        <span className="mr-1 text-sm text-gray-500 ml-1">{t('pos.units')}</span>
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg col-span-2">
                      <p className="mb-1 text-sm text-gray-500">{t('pos.productDialog.expiryDate')}</p>
                      {selectedProduct && (() => {
                        const { formattedDate, statusText, statusClass } = formatExpiryDate(selectedProduct.expiry_date, t as (key: string) => string);
                        return (
                          <div className="space-y-1">
                            <p className={`text-sm font-medium ${statusClass}`}>
                              {statusText}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="mt-6">
              <Button 
                onClick={() => setIsProductDialogOpen(false)}
                className="w-full"
              >
                {t('common.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
    
  )
  
}
