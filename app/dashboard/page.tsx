"use client"

import React, { useState, useEffect, useMemo, memo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { CalendarIcon, 
  DollarSign, 
  ShoppingCart, 
  TrendingUp, 
  Users, 
  Plus, 
  Pencil, 
  Trash2, 
  MoreHorizontal, 
  Settings, 
  AlertTriangle,
  Package,
  Bell} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar, DateRange } from "@/components/ui/calendar"
import { addDays, format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isSameDay, isYesterday, parseISO, isValid, differenceInDays } from "date-fns"
import Image from 'next/image'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Footer } from "@/components/footer"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { useTranslation } from '@/hooks/useTranslation'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or Key is missing');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD' }).format(value)
}

interface Product {
  id: string
  product_name: string
  category: string
  product_img_path: string
  product_stock: number
  product_barcode: string
  product_price: number
  created_at: string
  expiry_date: string
}

interface Category {
  id: string
  category: string
}

interface InventoryItem {
  product_id: string
  inventory_product_name: string
  inventory_category_name: string
  inventory_product_img_path: string
  inventory_product_price: number
  inventory_product_barcode: string
  quantity: number
  inventory_expiry_date: string
}

interface SalesData {
  date: string
  total: number
}

interface TopProduct {
  product_name: string
  total_sold: number
}

interface Notification {
  id: string
  type: 'low_stock' | 'expiring_soon'
  message: string
  read: boolean
  created_at: Date
}


const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

// Füge diese Hilfsfunktion am Anfang der Datei hinzu, nach den Imports
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Fügen Sie diesen custom hook hinzu
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default function Dashboard() {
  const { t } = useTranslation()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [newProduct, setNewProduct] = useState<Product>({ 
    id: '', 
    product_name: '', 
    category: '', 
    product_img_path: '', 
    product_stock: 0,
    product_barcode: '',
    product_price: 0,
    created_at: new Date().toISOString(),
    expiry_date: ''
  })
  
  useEffect(() => {
    let isSubscribed = true;

    const checkNotifications = async () => {
      if (!isSubscribed) return;

      // Hole existierende Benachrichtigungen
      const { data: existingNotifications, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError || !isSubscribed) {
        console.error("Error fetching notifications:", fetchError)
        return
      }

      const today = new Date()
      let newNotificationsToAdd: Notification[] = []

      // Hilfsfunktion zum Prüfen von Duplikaten
      const isDuplicate = (type: 'low_stock' | 'expiring_soon', message: string) => {
        return existingNotifications?.some(n => n.type === type && n.message === message) ||
               newNotificationsToAdd.some(n => n.type === type && n.message === message)
      }

      // Überprüfe jedes Produkt für neue Benachrichtigungen
      for (const product of products) {
        if (!isSubscribed) return;

        // Überprüfe niedrigen Lagerbestand
        if (product.product_stock < 10) {
          const message = t('dashboard.notifications.messages.lowStock', {
            productName: product.product_name,
            quantity: product.product_stock
          })
          
          if (!isDuplicate('low_stock', message)) {
            newNotificationsToAdd.push({
              id: generateUUID(),
              type: 'low_stock',
              message,
              read: false,
              created_at: today
            })
          }
        }

        // Überprüfe Ablaufdatum
        const expiryDate = parseISO(product.expiry_date)
        const daysUntilExpiry = differenceInDays(expiryDate, today)
        
        if (daysUntilExpiry < 0) {
          const message = t('dashboard.notifications.messages.expired', {
            productName: product.product_name,
            days: Math.abs(daysUntilExpiry)
          })
          
          if (!isDuplicate('expiring_soon', message)) {
            newNotificationsToAdd.push({
              id: generateUUID(),
              type: 'expiring_soon',
              message,
              read: false,
              created_at: today
            })
          }
        } else if (daysUntilExpiry === 0) {
          const message = t('dashboard.notifications.messages.expirestoday', {
            productName: product.product_name
          })
          
          if (!isDuplicate('expiring_soon', message)) {
            newNotificationsToAdd.push({
              id: generateUUID(),
              type: 'expiring_soon',
              message,
              read: false,
              created_at: today
            })
          }
        } else if (daysUntilExpiry <= 30) {
          const message = t('dashboard.notifications.messages.expiresSoon', {
            productName: product.product_name,
            days: daysUntilExpiry
          })
          
          if (!isDuplicate('expiring_soon', message)) {
            newNotificationsToAdd.push({
              id: generateUUID(),
              type: 'expiring_soon',
              message,
              read: false,
              created_at: today
            })
          }
        }
      }

      if (!isSubscribed) return;

      // Füge neue Benachrichtigungen zur Datenbank hinzu
      if (newNotificationsToAdd.length > 0) {
        const { error: insertError } = await supabase
          .from('notifications')
          .insert(newNotificationsToAdd.map(n => ({
            ...n,
            created_at: n.created_at instanceof Date ? n.created_at.toISOString() : n.created_at
          })))

        if (insertError) {
          console.error("Error inserting notifications:", insertError)
          return
        }
      }

      if (!isSubscribed) return;

      // Aktualisiere den Frontend-State mit allen Benachrichtigungen
      setNotifications([
        ...newNotificationsToAdd,
        ...(existingNotifications || [])
      ])
    }

    checkNotifications()
    const interval = setInterval(checkNotifications, 300000) // Alle 5 Minuten

    return () => {
      isSubscribed = false
      clearInterval(interval)
    }
  }, [products])

  const markNotificationAsRead = async (id: string) => {
    // Update Frontend-State
    setNotifications(prevNotifications =>
      prevNotifications.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    )

    // Update Datenbank
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)

    if (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const unreadNotificationsCount = notifications.filter(n => !n.read).length


  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const [newInventoryItem, setNewInventoryItem] = useState<InventoryItem>({
    product_id: '',
    inventory_product_name: '',
    inventory_category_name: '',
    inventory_product_img_path: '',
    inventory_product_price: 0,
    inventory_product_barcode: '',
    quantity: 0,
    inventory_expiry_date: ''
  })


  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItem | null>(null)
  const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false)
  const [isEditInventoryItemDialogOpen, setIsEditInventoryItemDialogOpen] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date())
  })
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [categoryData, setCategoryData] = useState<{name: string, value: number}[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [averageOrderValue, setAverageOrderValue] = useState(0)
  const [totalSales, setTotalSales] = useState(0)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [salesByCategory, setSalesByCategory] = useState<{name: string, value: number}[]>([])
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{id: string, type: 'product' | 'category' | 'inventory'} | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [expiryStatusFilter, setExpiryStatusFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [isFiltersVisible, setIsFiltersVisible] = useState(false)
  const [inventorySearchTerm, setInventorySearchTerm] = useState('')
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('all')
  const [inventoryStockFilter, setInventoryStockFilter] = useState('all')
  const [isInventoryFiltersVisible, setIsInventoryFiltersVisible] = useState(false)
  const [dateRangeLabel, setDateRangeLabel] = useState("Today")
  const router = useRouter()
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearchTerm = useDebounce(searchInput, 300);

  // Fügen Sie diesen State hinzu
  const [inventoryExpiryFilter, setInventoryExpiryFilter] = useState('all')

  // Fügen Sie diese Zeile zu den vorhandenen States hinzu
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    setInventorySearchTerm(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    fetchCategories()
    fetchProducts()
    fetchInventoryItems()
    fetchAnalyticsData()

    const channel = supabase
      .channel('table-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'category' }, () => {
        fetchCategories()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        fetchInventoryItems()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        fetchAnalyticsData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    fetchAnalyticsData()
    updateDateRangeLabel()
  }, [dateRange])

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('category')
      .select('*')

    if (error) {
      console.error("Error fetching categories:", error)
    } else {
      setCategories(data)
    }
  }

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')

    if (error) {
      console.error("Error fetching products:", error)
    } else {
      setProducts(data)
    }
  }

  const fetchInventoryItems = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
  
    if (error) {
      console.error("Error fetching inventory items:", error)
    } else {
      setInventoryItems(data)
    }
  }

  

  const fetchAnalyticsData = async () => {
    const startDate = dateRange.from || new Date()
    const endDate = dateRange.to || addDays(startDate, 1)
    
    // Fetch sales data
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('sale_date, total_amount')
      .gte('sale_date', startDate.toISOString())
      .lte('sale_date', endDate.toISOString())

    if (salesError) {
      console.error("Error fetching sales data:", salesError)
    } else {
      const formattedSalesData = salesData.map(sale => ({
        date: format(new Date(sale.sale_date), 'MMM dd'),
        total: sale.total_amount
      }))
      setSalesData(formattedSalesData)

      const totalRev = salesData.reduce((sum, sale) => sum + sale.total_amount, 0)
      setTotalRevenue(totalRev)
      setTotalSales(salesData.length)
      setAverageOrderValue(totalRev / salesData.length || 0)
    }

    // Fetch top products
    const { data: topProductsData, error: topProductsError } = await supabase
      .rpc('get_top_products_by_date_range', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      })

    if (topProductsError) {
      console.error("Error fetching top products:", topProductsError)
    } else {
      setTopProducts(topProductsData)
    }

    // Fetch unique customers
    const { count, error: customerError } = await supabase
      .from('sales')
      .select('user_id', { count: 'exact', head: true })
      .gte('sale_date', startDate.toISOString())
      .lte('sale_date', endDate.toISOString())

    if (customerError) {
      console.error("Error fetching customer count:", customerError)
    } else {
      setTotalCustomers(count || 0)
    }

    // Fetch sales by category
    const { data: salesByCategoryData, error: salesByCategoryError } = await supabase
      .rpc('get_sales_by_category', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      })

    if (salesByCategoryError) {
      console.error("Error fetching sales by category:", salesByCategoryError)
    } else {
      const formattedSalesByCategory = salesByCategoryData.map((item: { category: string; total_sales: number | string }) => ({
        name: item.category,
        value: Number(item.total_sales)
      }))
      setSalesByCategory(formattedSalesByCategory)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0])
    }
  }

    const handleAddProduct = async () => {
    if (newProduct.product_name && newProduct.category) {
      let imagePath = '';
      if (selectedImage) {
        try {
          const { data, error } = await supabase.storage
            .from('product_images')
            .upload(`${Date.now()}_${selectedImage.name}`, selectedImage);
          if (error) {
            console.error("Error uploading image:", error);
            return;
          }
          imagePath = data.path;
        } catch (error) {
          console.error("Error uploading image:", error);
          return;
        }
      }
      try {
        const { data, error } = await supabase
          .from('products')
          .insert([{
            product_name: newProduct.product_name,
            category: newProduct.category,
            product_img_path: imagePath,
            product_stock: newProduct.product_stock,
            product_barcode: newProduct.product_barcode,
            product_price: newProduct.product_price,
            expiry_date: newProduct.expiry_date
          }]);
        if (error) {
          console.error("Error adding product:", error);
        } else {
          console.log("Product added successfully:", data);
          setNewProduct({ id: '', product_name: '', category: '', product_img_path: '', product_stock: 0, product_barcode: '', product_price: 0, created_at: new Date().toISOString(), expiry_date: '' });
          setSelectedImage(null);
          fetchProducts();
        }
      } catch (error) {
        console.error("Error adding product:", error);
      }
    }
  };
  const handleEditProduct = (product: Product) => {
    setEditingProduct({...product})
    setIsEditProductDialogOpen(true)
  }
  const handleUpdateProduct = async () => {
    if (editingProduct) {
      let imagePath = editingProduct.product_img_path
      if (selectedImage) {
        const { data, error } = await supabase.storage
          .from('product_images')
          .upload(`${Date.now()}_${selectedImage.name}`, selectedImage)
        if (error) {
          console.error("Error uploading image:", error)
          return
        }
        imagePath = data.path
      }
      const { error } = await supabase
        .from('products')
        .update({
          product_name: editingProduct.product_name,
          category: editingProduct.category,
          product_img_path: imagePath,
          product_stock: editingProduct.product_stock,
          product_barcode: editingProduct.product_barcode,
          product_price: editingProduct.product_price,
          expiry_date: editingProduct.expiry_date
        })
        .eq('id', editingProduct.id)
      if (error) {
        console.error("Error updating product:", error)
      } else {
        setIsEditProductDialogOpen(false)
        setEditingProduct(null)
        setSelectedImage(null)
        fetchProducts()
      }
    }
  }



  const handleAddInventoryItem = async () => {
    if (newInventoryItem.product_id && newInventoryItem.quantity > 0) {
      try {
        const { data, error } = await supabase
          .from('inventory')
          .insert([{
            product_id: newInventoryItem.product_id,
            inventory_product_name: newInventoryItem.inventory_product_name,
            inventory_category_name: newInventoryItem.inventory_category_name,
            inventory_product_img_path: newInventoryItem.inventory_product_img_path,
            inventory_product_price: newInventoryItem.inventory_product_price,
            inventory_product_barcode: newInventoryItem.inventory_product_barcode,
            quantity: newInventoryItem.quantity,
            inventory_expiry_date: newInventoryItem.inventory_expiry_date
          }]);

        if (error) {
          console.error("Error adding inventory item:", error);
        } else {
          console.log("Inventory item added successfully:", data);
          setNewInventoryItem({
            product_id: '',
            inventory_product_name: '',
            inventory_category_name: '',
            inventory_product_img_path: '',
            inventory_product_price: 0,
            inventory_product_barcode: '',
            quantity: 0,
            inventory_expiry_date: ''
          });
          setSelectedProduct(null);
          fetchInventoryItems();
        }
      } catch (error) {
        console.error("Error adding inventory item:", error);
      }
    }
  }

  const handleEditInventoryItem = (item: InventoryItem) => {
    setEditingInventoryItem({...item})
    setIsEditInventoryItemDialogOpen(true)
  }

  const handleUpdateInventoryItem = async () => {
    if (editingInventoryItem) {
      let imagePath = editingInventoryItem.inventory_product_img_path
      if (selectedImage) {
        const { data, error } = await supabase.storage
          .from('product_images')
          .upload(`inventory_${Date.now()}_${selectedImage.name}`, selectedImage)
  
        if (error) {
          console.error("Error uploading image:", error)
          return
        }
  
        imagePath = data.path
      }
  
      const { error } = await supabase
        .from('inventory')
        .update({
          inventory_product_name: editingInventoryItem.inventory_product_name,
          inventory_category_name: editingInventoryItem.inventory_category_name,
          inventory_product_img_path: imagePath,
          inventory_product_price: editingInventoryItem.inventory_product_price,
          inventory_product_barcode: editingInventoryItem.inventory_product_barcode,
          quantity: editingInventoryItem.quantity,
          inventory_expiry_date: editingInventoryItem.inventory_expiry_date
        })
        .eq('product_id', editingInventoryItem.product_id)
  
      if (error) {
        console.error("Error updating inventory item:", error)
      } else {
        setIsEditInventoryItemDialogOpen(false)
        setEditingInventoryItem(null)
        setSelectedImage(null)
        fetchInventoryItems()
      }
    }
  }

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (product) {
      setSelectedProduct(product)
      setNewInventoryItem({
        ...newInventoryItem,
        product_id: product.id,
        inventory_product_name: product.product_name,
        inventory_category_name: product.category,
        inventory_product_img_path: product.product_img_path,
        inventory_product_barcode: product.product_barcode,
      })
    }
  }

  // Aktualisierte handleDeleteItem-Funktion
const handleDeleteItem = async () => {
  if (itemToDelete) {
    const { id, type } = itemToDelete
    const { error } = await supabase
      .from(type === 'product' ? 'products' : type === 'category' ? 'category' : 'inventory')
      .delete()
      .eq(type === 'inventory' ? 'product_id' : 'id', id)

    if (error) {
      console.error(`Error deleting ${type}:`, error)
    } else {
      if (type === 'product') {
        fetchProducts()
      } else if (type === 'category') {
        fetchCategories()
      } else {
        fetchInventoryItems()
      }
    }
    setIsDeleteAlertOpen(false)
    setItemToDelete(null)
  }
}

  const handleAddCategory = async () => {
    if (newCategory) {
      const { error } = await supabase
        .from('category')
        .insert([{ category: newCategory }])
      if (error) {
        console.error("Error adding category:", error)
      } else {
        setNewCategory('')
        fetchCategories()
      }
    }
  }
  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setIsEditCategoryDialogOpen(true)
  }
  const handleUpdateCategory = async () => {
    if (editingCategory) {
      const { error } = await supabase
        .from('category')
        .update({ category: editingCategory.category })
        .eq('id', editingCategory.id)
      if (error) {
        console.error("Error updating category:", error)
      } 
      else {
        setIsEditCategoryDialogOpen(false)
        setEditingCategory(null)
        fetchCategories()
      }
    }
  }

  const setDateRangeAndClose = (range: DateRange | undefined) => {
    if (range?.from) {
      setDateRange({ from: range.from, to: range.to || range.from })
    } else {
      setDateRange({ from: undefined, to: undefined })
    }
    updateDateRangeLabel()
  }
  const getDateRangeText = () => {
    if (!dateRange.from) return "Select date range"
    if (!dateRange.to) return format(dateRange.from, "PPP")
    return `${format(dateRange.from, "PPP")} - ${format(dateRange.to, "PPP")}`
  }
  const setPresetRange = (preset: string) => {
    const now = new Date()
    switch (preset) {
      case "today":
        setDateRange({ from: startOfDay(now), to: endOfDay(now) })
        setDateRangeLabel("Today")
        break
      case "yesterday":
        const yesterday = addDays(now, -1)
        setDateRange({ from: startOfDay(yesterday), to: endOfDay(yesterday) })
        setDateRangeLabel("Yesterday")
        break
      case "week":
        setDateRange({ from: startOfWeek(now), to: endOfWeek(now) })
        setDateRangeLabel("This Week")
        break
      case "month":
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) })
        setDateRangeLabel("This Month")
        break
      case "year":
        setDateRange({ from: startOfYear(now), to: endOfYear(now) })
        setDateRangeLabel("This Year")
        break
    }
  }
  const updateDateRangeLabel = () => {
    if (!dateRange.from) {
      setDateRangeLabel("Select date range")
      return
    }
    
    if (isSameDay(dateRange.from, dateRange.to || dateRange.from)) {
      if (isSameDay(dateRange.from, new Date())) {
        setDateRangeLabel("Today")
      } else if (isYesterday(dateRange.from)) {
        setDateRangeLabel("Yesterday")
      } else {
        setDateRangeLabel(format(dateRange.from, "PPP"))
      }
    } else if (
      isSameDay(dateRange.from, startOfWeek(dateRange.from)) && 
      isSameDay(dateRange.to || dateRange.from, endOfWeek(dateRange.from))
    ) {
      setDateRangeLabel("This Week")
    } else if (
      isSameDay(dateRange.from, startOfMonth(dateRange.from)) && 
      isSameDay(dateRange.to || dateRange.from, endOfMonth(dateRange.from))
    ) {
      setDateRangeLabel("This Month")
    } else if (
      isSameDay(dateRange.from, startOfYear(dateRange.from)) && 
      isSameDay(dateRange.to || dateRange.from, endOfYear(dateRange.from))
    ) {
      setDateRangeLabel("This Year")
    } else {
      setDateRangeLabel(`${format(dateRange.from, "PPP")} - ${format(dateRange.to || dateRange.from, "PPP")}`)
    }
  }
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString)
    return isValid(date) ? format(date, 'MMM dd, yyyy') : 'Invalid Date'
  }


  const getExpiryStatus = (expiryDate: string) => {
    const today = new Date()
    const expiry = parseISO(expiryDate)
    if (!isValid(expiry)) return { text: 'Invalid Date', color: 'bg-gray-100 text-gray-800' }

    const daysUntilExpiry = differenceInDays(expiry, today)

    if (daysUntilExpiry < 0) {
      return { text: 'Expired', color: 'bg-red-100 text-red-800' }
    } else if (daysUntilExpiry === 0) {
      return { text: 'Expires today', color: 'bg-orange-100 text-orange-800' }
    } else if (daysUntilExpiry <= 30) {
      return { text: `${daysUntilExpiry} days`, color: 'bg-yellow-100 text-yellow-800' }
    } else {
      return { text: `${daysUntilExpiry} days`, color: 'bg-green-100 text-green-800' }
    }
  }

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
    const matchesExpiryStatus = expiryStatusFilter === 'all' || getExpiryStatus(product.expiry_date).text.includes(expiryStatusFilter)
    const matchesStock = stockFilter === 'all' || 
      (stockFilter === 'low' && product.product_stock < 10) ||
      (stockFilter === 'medium' && product.product_stock >= 10 && product.product_stock < 50) ||
      (stockFilter === 'high' && product.product_stock >= 50)

    return matchesSearch && matchesCategory && matchesExpiryStatus && matchesStock
  })

  // Memoize komplexe Berechnungen
  const filteredInventory = useMemo(() => {
    return inventoryItems.filter(item => {
      const matchesSearch = item.inventory_product_name.toLowerCase().includes(inventorySearchTerm.toLowerCase())
      const matchesCategory = inventoryCategoryFilter === 'all' || item.inventory_category_name === inventoryCategoryFilter
      const matchesStock = inventoryStockFilter === 'all' || 
        (inventoryStockFilter === 'low' && item.quantity < 10) ||
        (inventoryStockFilter === 'medium' && item.quantity >= 10 && item.quantity < 50) ||
        (inventoryStockFilter === 'high' && item.quantity >= 50)

      // Neue Logik für den Expiry Filter
      const today = new Date()
      const expiryDate = parseISO(item.inventory_expiry_date)
      const daysUntilExpiry = differenceInDays(expiryDate, today)
      
      const matchesExpiry = inventoryExpiryFilter === 'all' ||
        (inventoryExpiryFilter === 'expired' && daysUntilExpiry < 0) ||
        (inventoryExpiryFilter === 'expires-today' && daysUntilExpiry === 0) ||
        (inventoryExpiryFilter === 'expires-soon' && daysUntilExpiry > 0 && daysUntilExpiry <= 30) ||
        (inventoryExpiryFilter === 'good' && daysUntilExpiry > 30)

      return matchesSearch && matchesCategory && matchesStock && matchesExpiry
    })
  }, [inventoryItems, inventorySearchTerm, inventoryCategoryFilter, inventoryStockFilter, inventoryExpiryFilter])

  // Memoize Chart Components
  const SalesChart = memo(({ data }: { data: SalesData[] }) => {
    return (
      <ChartContainer config={{
        sales: {
          label: "Sales",
          color: "hsl(var(--chart-1))",
        },
      }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="total" stroke="var(--color-sales)" />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    );
  });

  // Füge diese neue Funktion hinzu
  const handlePopoverOpenChange = async (open: boolean) => {
    if (open) {
      const unreadNotifications = notifications.filter(n => !n.read)
      
      if (unreadNotifications.length > 0) {
        // Update Frontend-State
        const updatedNotifications = notifications.map(notification => ({
          ...notification,
          read: true
        }))
        setNotifications(updatedNotifications)

        // Update Datenbank für jede ungelesene Benachrichtigung einzeln
        for (const notification of unreadNotifications) {
          const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notification.id)

          if (error) {
            console.error(`Error updating notification ${notification.id}:`, error)
          }
        }
      }
    }
  }

  const [productsCurrentPage, setProductsCurrentPage] = useState(1)
  const productsPerPage = 10

  // Fügen Sie diese Berechnung nach den anderen useMemo-Hooks hinzu
  const paginatedProducts = useMemo(() => {
    const startIndex = (productsCurrentPage - 1) * productsPerPage
    return filteredProducts.slice(startIndex, startIndex + productsPerPage)
  }, [filteredProducts, productsCurrentPage])

  const totalProductPages = useMemo(() => {
    return Math.ceil(filteredProducts.length / productsPerPage)
  }, [filteredProducts])

  // Nach den anderen useState Hooks (ca. Zeile 329) fügen Sie hinzu:
  const [inventoryCurrentPage, setInventoryCurrentPage] = useState(1)
  const inventoryPerPage = 10

  // Nach den anderen useMemo Hooks fügen Sie hinzu:
  const paginatedInventory = useMemo(() => {
    const startIndex = (inventoryCurrentPage - 1) * inventoryPerPage
    return filteredInventory.slice(startIndex, startIndex + inventoryPerPage)
  }, [filteredInventory, inventoryCurrentPage])

  const totalInventoryPages = useMemo(() => {
    return Math.ceil(filteredInventory.length / inventoryPerPage)
  }, [filteredInventory])

  return (
    <div className='flex h-screen flex-col'>
    <div className="flex-1 space-y-4 p-8 pt-6">
      {/* Kopfzeile des Dashboards */}
      <div className="flex items-center justify-between space-y-2">
       
        <div className="flex items-center space-x-2 gap-2">
        <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={`w-[360px] justify-start text-left font-normal`}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {getDateRangeText()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Select onValueChange={setPresetRange}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder={t('dashboard.dateRanges.selectRange')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">{t('dashboard.dateRanges.today')}</SelectItem>
                  <SelectItem value="yesterday">{t('dashboard.dateRanges.yesterday')}</SelectItem>
                  <SelectItem value="week">{t('dashboard.dateRanges.thisWeek')}</SelectItem>
                  <SelectItem value="month">{t('dashboard.dateRanges.thisMonth')}</SelectItem>
                  <SelectItem value="year">{t('dashboard.dateRanges.thisYear')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="border-t border-gray-200 p-3">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={dateRange}
                  onSelect={setDateRangeAndClose}
                  numberOfMonths={2}
                />
              </div>
            </PopoverContent>
          </Popover>
        <Popover onOpenChange={handlePopoverOpenChange}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
               <Bell className="h-4 w-4 transform scale-x-[-1]" />
                {unreadNotificationsCount > 0 && (
                  <Badge className="absolute -top-2 right-6 h-5 w-5 rounded-full p-0 text-xs">
                    {unreadNotificationsCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="end">
              
                <CardHeader>
                  <CardTitle>{t('dashboard.notifications.title')}</CardTitle>
                </CardHeader>
               
                  <ScrollArea className="h-[300px] w-full rounded-md">
                    {notifications.length > 0 ? (
                      notifications.map(notification => (
                        <div
                          key={notification.id}
                          className={cn(
                            "flex items-start space-x-4 p-4 hover:bg-accent transition-colors duration-200",
                            notification.read ? "opacity-60" : ""
                          )}
                          onClick={() => markNotificationAsRead(notification.id)}
                        >
                          <div className="flex-1  text-right">
                            <p className="text-sm font-medium">{notification.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(notification.created_at, 'PPp')}
                            </p>
                          </div>
                          <div className={cn(
                            "rounded-full p-2",
                            notification.type === 'low_stock' ? "bg-yellow-100" : "bg-red-100"
                          )}>
                            {notification.type === 'low_stock' ? (
                              <Package className="h-4 w-4 text-yellow-600" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                          
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-center text-muted-foreground">
                          {t('dashboard.notifications.noNotifications')}
                        </p>
                      </div>
                    )}
                  </ScrollArea>
               
              
            </PopoverContent>
          </Popover>
          

         
        </div>
        <h2 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h2>
      </div>
      {/* Tabs für verschiedene Bereiche des Dashboards */}
      <Tabs dir='rtl' value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex justify-start ">
          <TabsList >
            <TabsTrigger value="overview">{t('dashboard.overview.title')}</TabsTrigger>
            <TabsTrigger value="products">{t('dashboard.products.title')}</TabsTrigger>
            <TabsTrigger value="categories">{t('dashboard.categories.title')}</TabsTrigger>
            <TabsTrigger value="inventory">{t('dashboard.inventory.title')}</TabsTrigger>
          </TabsList>
        </div>
         {/* overview-Tab */}
        <TabsContent  dir='rtl' value="overview" className="space-y-4">
          {/* Karten für Gesamtumsatz, Verkäufe, Kunden und durchschnittlichen Bestellwert */}
          <div  className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('dashboard.overview.totalRevenue')} ({dateRangeLabel})
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                  +20% {t('dashboard.overview.fromPreviousPeriod')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('dashboard.overview.sales')} ({dateRangeLabel})
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+{totalSales}</div>
                <p className="text-xs text-muted-foreground">
                  +180.1% {t('dashboard.overview.fromPreviousPeriod')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('dashboard.overview.customers')} ({dateRangeLabel})
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+{totalCustomers}</div>
                <p className="text-xs text-muted-foreground">
                  +19% {t('dashboard.overview.fromPreviousPeriod')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('dashboard.overview.averageOrderValue')} ({dateRangeLabel})
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(averageOrderValue)}</div>
                <p className="text-xs text-muted-foreground">
                  +201 {t('dashboard.overview.fromPreviousPeriod')}
                </p>
              </CardContent>
            </Card>
          </div>
           {/* Diagramme für Verkaufsübersicht und Top-Produkte */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
            
            <Card >
              <CardHeader>
                <CardTitle>{t('dashboard.overview.salesOverview')}</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <ChartContainer config={{
                  sales: {
                    label: "Sales",
                    color: "hsl(var(--chart-1))",
                  },
                }} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={salesData}
                      layout="horizontal"
                    >
                      <CartesianGrid 
                       
                      />
                      <XAxis 
                        dataKey="date" 
                        reversed={false}
                        orientation="bottom"
                        tick={{ 
                          textAnchor: 'end',
                          fill: 'currentColor',
                          fontSize: 12
                        }}
                      />
                      <YAxis 
                        orientation="right"
                        tick={{ 
                          textAnchor: 'end',
                          fill: 'currentColor',
                          fontSize: 12
                        }}
                        reversed={false}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Bar 
                        dataKey="total" 
                        fill="var(--color-sales)" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card >
              <CardHeader>
                <CardTitle>{t('dashboard.overview.topProducts')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{
                  sales: {
                    label: "Sales",
                    color: "hsl(var(--chart-1))",
                  },
                }} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {topProducts.length > 0 ? (
                      <BarChart 
                        data={topProducts} 
                        layout="vertical"
                      >
                        <CartesianGrid 
                          strokeDasharray="3 3"
                          horizontal={true}
                          vertical={true}
                        />
                        <XAxis 
                          type="number"
                          orientation="top"
                          reversed={true}
                          tick={{ 
                            textAnchor: 'end',
                            fill: 'currentColor',
                            fontSize: 12
                          }}
                        />
                        <YAxis 
                          dataKey="product_name" 
                          type="category"
                          orientation="right"
                          tick={{ 
                            textAnchor: 'end',
                            fill: 'currentColor',
                            fontSize: 12,
                            dx: 5
                          }}
                          reversed={false}
                        />
                        <ChartTooltip 
                          content={<ChartTooltipContent />}
                          cursor={{ fill: 'transparent' }}
                        />
                        <Bar 
                          dataKey="total_sold" 
                          fill="var(--color-sales)"
                        />
                      </BarChart>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">
                          {t('dashboard.overview.noDataAvailable')}
                        </p>
                      </div>
                    )}
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card >
              <CardHeader>
                <CardTitle>{t('dashboard.analytics.salesByCategory')}</CardTitle>
              </CardHeader>
              <CardContent className=' overflow-hidden flex justify-center'>
                <ChartContainer config={{
                  category: {
                    label: "Category",
                    color: "hsl(var(--chart-1))",
                  },
                }} className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {salesByCategory.length > 0 ? (
                      <PieChart >
                        <Pie
                          data={salesByCategory}
                          cx="50%"
                          cy="40%"
                          labelLine={false}
                          outerRadius={115}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={false}
                        >
                          {salesByCategory.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={COLORS[index % COLORS.length]} 
                            />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend
                          layout="horizontal"
                          verticalAlign="bottom"
                          align="center"
                          iconType="circle"
                          iconSize={12}
                          wrapperStyle={{
                            paddingTop: "10px",
                            fontSize: "14px"
                          }}
                          formatter={(value, entry, index) => (
                            <span className="mr-4 text-base font-medium">
                              {value} - {(salesByCategory[index]?.value || 0)}
                            </span>
                          )}
                        />
                      </PieChart>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">
                          {t('dashboard.analytics.noDataAvailable')}
                        </p>
                      </div>
                    )}
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card >
              <CardHeader>
                <CardTitle>{t('dashboard.analytics.keyMetrics')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6">
                  {/* Total Revenue Metric */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('dashboard.analytics.totalRevenue')}
                      </p>
                      <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <DollarSign className="h-6 w-6 text-primary" />
                    </div>
                  </div>

                  {/* Average Order Value Metric */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('dashboard.analytics.averageOrderValue')}
                      </p>
                      <p className="text-2xl font-bold">{formatCurrency(averageOrderValue)}</p>
                    </div>
                    <div className="p-3 rounded-full bg-green-100">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                  </div>

                  {/* Total Orders Metric */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('dashboard.analytics.totalOrders')}
                      </p>
                      <div className="flex items-baseline space-x-2">
                        <p className="text-2xl font-bold">{totalSales}</p>
                        <span className="text-sm font-medium text-green-600">+12.5%</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-full bg-blue-100">
                      <ShoppingCart className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* products-Tab */}
        <TabsContent value="products">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-2xl font-bold">{t('dashboard.products.title')}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.products.description')}
                </p>
              </div>
              <div className="flex space-x-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsFiltersVisible(!isFiltersVisible)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  {t('common.filter')}
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      {t('dashboard.products.addProduct')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[625px]">
                    <DialogHeader>
                      <DialogTitle>{t('dashboard.products.addProduct')}</DialogTitle>
                      <DialogDescription>
                        {t('dashboard.products.addProductDescription')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="product_name" className="text-right">
                          {t('dashboard.products.name')}
                        </Label>
                        <Input
                          id="product_name"
                          value={newProduct.product_name}
                          onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">
                          {t('dashboard.products.category')}
                        </Label>
                        <Select 
                          value={newProduct.category} 
                          onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue placeholder={t('dashboard.products.selectCategory')} />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.category}>{category.category}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="product_image" className="text-right">
                          {t('dashboard.products.productImage')}
                        </Label>
                        <div className="col-span-3">
                          <Input
                            id="product_image"
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                          />
                          {selectedImage && (
                            <div className="mt-2">
                              <Image
                                src={URL.createObjectURL(selectedImage)}
                                alt="Selected product image"
                                width={100}
                                height={100}
                                className="rounded-md"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="product_stock" className="text-right">
                          {t('dashboard.products.stock')}
                        </Label>
                        <Input
                          id="product_stock"
                          type="number"
                          value={newProduct.product_stock}
                          onChange={(e) => setNewProduct({ ...newProduct, product_stock: parseInt(e.target.value) })}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="product_barcode" className="text-right">
                          {t('dashboard.products.barcode')}
                        </Label>
                        <Input
                          id="product_barcode"
                          value={newProduct.product_barcode}
                          onChange={(e) => setNewProduct({ ...newProduct, product_barcode: e.target.value })}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="product_price" className="text-right">
                          {t('dashboard.products.price')}
                        </Label>
                        <Input
                          id="product_price"
                          type="number"
                          value={newProduct.product_price}
                          onChange={(e) => setNewProduct({ ...newProduct, product_price: parseFloat(e.target.value) })}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="expiry_date" className="text-right">
                          {t('dashboard.products.expiryDate')}
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-[280px] justify-start text-left font-normal",
                                !newProduct.expiry_date && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {newProduct.expiry_date ? format(new Date(newProduct.expiry_date), "PPP") : <span>{t('dashboard.products.pickADate')}</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={newProduct.expiry_date ? new Date(newProduct.expiry_date) : undefined}
                              onSelect={(date) => setNewProduct({ ...newProduct, expiry_date: date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '' })}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddProduct}>{t('dashboard.products.saveProduct')}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isFiltersVisible && (
                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="search">{t('common.search')}</Label>
                    <Input
                      id="search"
                      placeholder={t('dashboard.products.searchPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category-filter">{t('dashboard.products.categoryFilter')}</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger id="category-filter">
                        <SelectValue placeholder={t('dashboard.products.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('dashboard.products.allCategories')}</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.category}>
                            {category.category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="expiry-status-filter">{t('dashboard.products.expiryStatusFilter')}</Label>
                    <Select value={expiryStatusFilter} onValueChange={setExpiryStatusFilter}>
                      <SelectTrigger id="expiry-status-filter">
                        <SelectValue placeholder={t('dashboard.products.selectExpiryStatus')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('dashboard.products.allStatuses')}</SelectItem>
                        <SelectItem value="Expired">{t('dashboard.products.expired')}</SelectItem>
                        <SelectItem value="Expires today">{t('dashboard.products.expiresToday')}</SelectItem>
                        <SelectItem value="days">{t('dashboard.products.notExpired')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="stock-filter">{t('dashboard.products.stockLevel')}</Label>
                    <Select value={stockFilter} onValueChange={setStockFilter}>
                      <SelectTrigger id="stock-filter">
                        <SelectValue placeholder={t('dashboard.products.selectStockLevel')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('dashboard.products.allLevels')}</SelectItem>
                        <SelectItem value="low">{t('dashboard.products.lowStock', { count: 10 })}</SelectItem>
                        <SelectItem value="medium">{t('dashboard.products.mediumStock', { count: 50 })}</SelectItem>
                        <SelectItem value="high">{t('dashboard.products.highStock', { count: 50 })}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {categoryFilter !== 'all' && (
                <div className="mb-4 flex items-center justify-between bg-muted/50 p-2 rounded-md">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span>
                      {t('dashboard.products.filteringByCategory', { category: categoryFilter })}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setCategoryFilter('all');
                      setIsFiltersVisible(false);
                    }}
                  >
                    {t('dashboard.products.clearFilter')}
                  </Button>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                  <TableHead className="w-[80px]"></TableHead>
                    <TableHead>{t('dashboard.products.name')}</TableHead>
                    <TableHead>{t('dashboard.products.category')}</TableHead>
                    <TableHead>{t('dashboard.products.price')}</TableHead>
                    <TableHead>{t('dashboard.products.stock')}</TableHead>
                    <TableHead>{t('dashboard.products.expiryDate')}</TableHead>
                    <TableHead>{t('dashboard.products.expiryStatus')}</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {paginatedProducts.map((product) => {
                    const expiryStatus = getExpiryStatus(product.expiry_date)
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <Image
                            src={product.product_img_path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product_images/${product.product_img_path}` : "/placeholder.svg"}
                            alt={product.product_name}
                            width={40}
                            height={40}
                            className="rounded-md object-cover"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{product.product_name}</TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell>{formatCurrency(product.product_price)}</TableCell>
                        <TableCell>{product.product_stock}</TableCell>
                        <TableCell>{formatDate(product.expiry_date)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${expiryStatus.color}`}>
                            {expiryStatus.text}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                {t('common.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setItemToDelete({ id: product.id, type: 'product' })
                                  setIsDeleteAlertOpen(true)
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('common.delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between px-2">
                <div className="text-sm text-muted-foreground">
                  {t('dashboard.products.showingEntries', { start: ((productsCurrentPage - 1) * productsPerPage) + 1, end: Math.min(productsCurrentPage * productsPerPage, filteredProducts.length), total: filteredProducts.length })}
                </div>
                <Pagination className="flex-1 justify-center">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault()
                          setProductsCurrentPage(prev => Math.max(1, prev - 1))
                        }}
                        className={cn(
                          "hover:bg-accent hover:text-accent-foreground",
                          productsCurrentPage === 1 ? "pointer-events-none opacity-50" : ""
                        )}
                      />
                    </PaginationItem>
                    
                    {[...Array(totalProductPages)].map((_, i) => {
                      const pageNumber = i + 1;
                      
                      // Logik für sichtbare Seitenzahlen
                      const isVisible = 
                        pageNumber === 1 || // Erste Seite
                        pageNumber === totalProductPages || // Letzte Seite
                        (pageNumber >= productsCurrentPage - 1 && pageNumber <= productsCurrentPage + 1); // Aktuelle Seite und Nachbarn
                      
                      // Logik für Ellipsis
                      const showEllipsisBefore = pageNumber === productsCurrentPage - 2 && productsCurrentPage > 3;
                      const showEllipsisAfter = pageNumber === productsCurrentPage + 2 && productsCurrentPage < totalProductPages - 2;
                      
                      if (showEllipsisBefore) {
                        return <PaginationEllipsis key={`ellipsis-before-${pageNumber}`} />;
                      }
                      
                      if (showEllipsisAfter) {
                        return <PaginationEllipsis key={`ellipsis-after-${pageNumber}`} />;
                      }
                      
                      if (isVisible) {
                        return (
                          <PaginationItem key={pageNumber}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setProductsCurrentPage(pageNumber);
                              }}
                              isActive={pageNumber === productsCurrentPage}
                              className={cn(
                                "min-w-[2rem] h-8 rounded-md flex items-center justify-center",
                                pageNumber === productsCurrentPage
                                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                  : "hover:bg-accent hover:text-accent-foreground"
                              )}
                            >
                              {pageNumber}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                      
                      return null;
                    })}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setProductsCurrentPage(prev => Math.min(totalProductPages, prev + 1))
                        }}
                        className={cn(
                          "hover:bg-accent hover:text-accent-foreground",
                          productsCurrentPage === totalProductPages ? "pointer-events-none opacity-50" : ""
                        )}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <div className="min-w-[100px]"></div> {/* Spacer für bessere Zentrierung */}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Kategorien-Tab */}
        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-2xl font-bold">{t('dashboard.categories.title')}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.categories.description')}
                </p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('dashboard.categories.addCategory')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{t('dashboard.categories.addCategory')}</DialogTitle>
                    <DialogDescription>
                      {t('dashboard.categories.addCategoryDescription')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="category_name" className="text-right">
                        {t('dashboard.categories.name')}
                      </Label>
                      <Input
                        id="category_name"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" onClick={handleAddCategory}>{t('dashboard.categories.saveCategory')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => (
                  <Card key={category.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between p-4">
                      <div className="flex items-center space-x-4 gap-2">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{category.category}</h3>
                          <p className="text-sm text-muted-foreground">
                            {products.filter(p => p.category === category.category).length} {t('dashboard.categories.products')}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditCategory(category)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              setItemToDelete({ id: category.id, type: 'category' })
                              setIsDeleteAlertOpen(true)
                            }}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center space-x-2 gap-2">
                          <Badge variant="secondary">
                            {formatCurrency(
                              products
                                .filter(p => p.category === category.category)
                                .reduce((sum, p) => sum + p.product_price, 0)
                            )}
                          </Badge>
                          <Badge variant="outline">
                            {products
                              .filter(p => p.category === category.category)
                              .reduce((sum, p) => sum + p.product_stock, 0)} {t('dashboard.categories.inStock')}
                          </Badge>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setCategoryFilter(category.category);
                            setIsFiltersVisible(true); // Zeigt die Filter an
                            setActiveTab("products"); // Wechselt automatisch zum Products-Tab
                          }}
                        >
                          {t('dashboard.categories.viewProducts')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      
        {/* inventory-Tab */}
        <TabsContent value="inventory">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-2xl font-bold">{t('dashboard.inventory.title')}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('dashboard.inventory.description')}
              </p>
            </div>
            <div className="flex space-x-2 gap-2">
              {/* Füge den Filter-Button hinzu */}
              <Button
                variant="outline"
                onClick={() => setIsInventoryFiltersVisible(!isInventoryFiltersVisible)}
              >
                <Settings className="mr-2 h-4 w-4" />
                {t('common.filter')}
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('dashboard.inventory.addInventoryItem')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[625px]">
                  <DialogHeader>
                    <DialogTitle>{t('dashboard.inventory.addInventoryItem')}</DialogTitle>
                    <DialogDescription>
                      {t('dashboard.inventory.addInventoryItemDescription')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="product_select" className="text-right">
                        {t('dashboard.inventory.selectProduct')}
                      </Label>
                      <Select
                        value={selectedProduct?.id || ''}
                        onValueChange={handleProductSelect}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder={t('dashboard.inventory.selectProduct')} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.product_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="inventory_product_name" className="text-right">
                        {t('dashboard.inventory.name')}
                      </Label>
                      <Input
                        id="inventory_product_name"
                        value={newInventoryItem.inventory_product_name}
                        className="col-span-3"
                        disabled
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="inventory_category_name" className="text-right">
                        {t('dashboard.inventory.category')}
                      </Label>
                      <Input
                        id="inventory_category_name"
                        value={newInventoryItem.inventory_category_name}
                        className="col-span-3"
                        disabled
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="inventory_product_barcode" className="text-right">
                        {t('dashboard.inventory.barcode')}
                      </Label>
                      <Input
                        id="inventory_product_barcode"
                        value={newInventoryItem.inventory_product_barcode}
                        className="col-span-3"
                        disabled
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="inventory_product_price" className="text-right">
                        {t('dashboard.inventory.price')}
                      </Label>
                      <Input
                        id="inventory_product_price"
                        type="number"
                        value={newInventoryItem.inventory_product_price}
                        onChange={(e) => setNewInventoryItem({ ...newInventoryItem, inventory_product_price: parseFloat(e.target.value) })}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="quantity" className="text-right">
                        {t('dashboard.inventory.quantity')}
                      </Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={newInventoryItem.quantity}
                        onChange={(e) => setNewInventoryItem({ ...newInventoryItem, quantity: parseInt(e.target.value) })}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="inventory_expiry_date" className="text-right">
                        {t('dashboard.inventory.expiryDate')}
                      </Label>
                      <Input
                        id="inventory_expiry_date"
                        type="date"
                        value={newInventoryItem.inventory_expiry_date}
                        onChange={(e) => setNewInventoryItem({ ...newInventoryItem, inventory_expiry_date: e.target.value })}
                        className="col-span-3"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" onClick={handleAddInventoryItem}>{t('dashboard.inventory.saveInventoryItem')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
            <CardContent>
              {isInventoryFiltersVisible && (
                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <Label htmlFor="inventory-search">{t('common.search')}</Label>
                    <Input
                      id="inventory-search"
                      placeholder={t('dashboard.inventory.searchPlaceholder')}
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="inventory-category-filter">{t('dashboard.inventory.categoryFilter')}</Label>
                    <Select value={inventoryCategoryFilter} onValueChange={setInventoryCategoryFilter}>
                      <SelectTrigger id="inventory-category-filter">
                        <SelectValue placeholder={t('dashboard.inventory.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('dashboard.inventory.allCategories')}</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.category}>
                            {category.category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="inventory-expiry-filter">{t('dashboard.inventory.expiryStatusFilter')}</Label>
                    <Select value={inventoryExpiryFilter} onValueChange={setInventoryExpiryFilter}>
                      <SelectTrigger id="inventory-expiry-filter">
                        <SelectValue placeholder={t('dashboard.inventory.selectExpiryStatus')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('dashboard.inventory.allStatuses')}</SelectItem>
                        <SelectItem value="expired">{t('dashboard.inventory.expired')}</SelectItem>
                        <SelectItem value="expires-today">{t('dashboard.inventory.expiresToday')}</SelectItem>
                        <SelectItem value="expires-soon">{t('dashboard.inventory.expiresSoon', { days: 30 })}</SelectItem>
                        <SelectItem value="good">{t('dashboard.inventory.good')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="inventory-stock-filter">{t('dashboard.inventory.stockLevel')}</Label>
                    <Select value={inventoryStockFilter} onValueChange={setInventoryStockFilter}>
                      <SelectTrigger id="inventory-stock-filter">
                        <SelectValue placeholder={t('dashboard.inventory.selectStockLevel')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('dashboard.inventory.allLevels')}</SelectItem>
                        <SelectItem value="low">{t('dashboard.inventory.lowStock', { count: 10 })}</SelectItem>
                        <SelectItem value="medium">{t('dashboard.inventory.mediumStock', { count: 50 })}</SelectItem>
                        <SelectItem value="high">{t('dashboard.inventory.highStock', { count: 50 })}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dashboard.inventory.image')}</TableHead>
                    <TableHead>{t('dashboard.inventory.name')}</TableHead>
                    <TableHead>{t('dashboard.inventory.category')}</TableHead>
                    <TableHead>{t('dashboard.inventory.quantity')}</TableHead>
                    <TableHead>{t('dashboard.inventory.price')}</TableHead>
                    <TableHead>{t('dashboard.inventory.expiryDate')}</TableHead>
                    <TableHead>{t('dashboard.inventory.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInventory.map((item) => (
                    <TableRow key={item.product_id}>
                      <TableCell>
                        {item.inventory_product_img_path ? (
                          <Image
                            src={`${supabaseUrl}/storage/v1/object/public/product_images/${item.inventory_product_img_path}`}
                            alt={item.inventory_product_name}
                            width={50}
                            height={50}
                            className="rounded-md"
                          />
                        ) : (
                          <div className="w-[50px] h-[50px] bg-gray-200 rounded-md flex items-center justify-center">
                            {t('dashboard.inventory.noImage')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{item.inventory_product_name}</TableCell>
                      <TableCell>{item.inventory_category_name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatCurrency(item.inventory_product_price)}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getExpiryStatus(item.inventory_expiry_date).color}`}>
                            {getExpiryStatus(item.inventory_expiry_date).text}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditInventoryItem(item)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {t('common.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setItemToDelete({ id: item.product_id, type: 'inventory' })
                              setIsDeleteAlertOpen(true)
                            }}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('common.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between px-2">
                <div className="text-sm text-muted-foreground">
                  {t('dashboard.inventory.showingEntries', { start: ((inventoryCurrentPage - 1) * inventoryPerPage) + 1, end: Math.min(inventoryCurrentPage * inventoryPerPage, filteredInventory.length), total: filteredInventory.length })}
                </div>
                <Pagination className="flex-1 justify-center">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault()
                          setInventoryCurrentPage(prev => Math.max(1, prev - 1))
                        }}
                        className={cn(
                          "hover:bg-accent hover:text-accent-foreground",
                          inventoryCurrentPage === 1 ? "pointer-events-none opacity-50" : ""
                        )}
                      />
                    </PaginationItem>
                    
                    {[...Array(totalInventoryPages)].map((_, i) => {
                      const pageNumber = i + 1;
                      
                      const isVisible = 
                        pageNumber === 1 || // Erste Seite
                        pageNumber === totalInventoryPages || // Letzte Seite
                        (pageNumber >= inventoryCurrentPage - 1 && pageNumber <= inventoryCurrentPage + 1); // Aktuelle Seite und Nachbarn
                      
                      const showEllipsisBefore = pageNumber === inventoryCurrentPage - 2 && inventoryCurrentPage > 3;
                      const showEllipsisAfter = pageNumber === inventoryCurrentPage + 2 && inventoryCurrentPage < totalInventoryPages - 2;
                      
                      if (showEllipsisBefore) {
                        return <PaginationEllipsis key={`ellipsis-before-${pageNumber}`} />;
                      }
                      
                      if (showEllipsisAfter) {
                        return <PaginationEllipsis key={`ellipsis-after-${pageNumber}`} />;
                      }
                      
                      if (isVisible) {
                        return (
                          <PaginationItem key={pageNumber}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setInventoryCurrentPage(pageNumber);
                              }}
                              isActive={pageNumber === inventoryCurrentPage}
                              className={cn(
                                "min-w-[2rem] h-8 rounded-md flex items-center justify-center",
                                pageNumber === inventoryCurrentPage
                                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                  : "hover:bg-accent hover:text-accent-foreground"
                              )}
                            >
                              {pageNumber}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                      
                      return null;
                    })}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setInventoryCurrentPage(prev => Math.min(totalInventoryPages, prev + 1))
                        }}
                        className={cn(
                          "hover:bg-accent hover:text-accent-foreground",
                          inventoryCurrentPage === totalInventoryPages ? "pointer-events-none opacity-50" : ""
                        )}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <div className="min-w-[100px]"></div> {/* Spacer für bessere Zentrierung */}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={isEditProductDialogOpen} onOpenChange={setIsEditProductDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>{t('dashboard.products.editProduct')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.products.updateProductDetails')}
            </DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_product_name" className="text-right">
                  {t('dashboard.products.name')}
                </Label>
                <Input
                  id="edit_product_name"
                  value={editingProduct.product_name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, product_name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_category" className="text-right">
                  {t('dashboard.products.category')}
                </Label>
                <Select 
                  value={editingProduct.category} 
                  onValueChange={(value) => setEditingProduct({ ...editingProduct, category: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={t('dashboard.products.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.category}>{category.category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_product_image" className="text-right">
                  {t('dashboard.products.productImage')}
                </Label>
                <div className="col-span-3">
                  <Input
                    id="edit_product_image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  {selectedImage ? (
                    <div className="mt-2">
                      <Image
                        src={URL.createObjectURL(selectedImage)}
                        alt="Selected product image"
                        width={100}
                        height={100}
                        className="rounded-md"
                      />
                    </div>
                  ) : editingProduct.product_img_path && (
                    <div className="mt-2">
                      <Image
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product_images/${editingProduct.product_img_path}`}
                        alt="Current product image"
                        width={100}
                        height={100}
                        className="rounded-md"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_product_stock" className="text-right">
                  {t('dashboard.products.stock')}
                </Label>
                <Input
                  id="edit_product_stock"
                  type="number"
                  value={editingProduct.product_stock}
                  onChange={(e) => setEditingProduct({ ...editingProduct, product_stock: parseInt(e.target.value) })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_product_barcode" className="text-right">
                  {t('dashboard.products.barcode')}
                </Label>
                <Input
                  id="edit_product_barcode"
                  value={editingProduct.product_barcode}
                  onChange={(e) => setEditingProduct({ ...editingProduct, product_barcode: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_product_price" className="text-right">
                  {t('dashboard.products.price')}
                </Label>
                <Input
                  id="edit_product_price"
                  type="number"
                  value={editingProduct.product_price}
                  onChange={(e) => setEditingProduct({ ...editingProduct, product_price: parseFloat(e.target.value) })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_expiry_date" className="text-right">
                  {t('dashboard.products.expiryDate')}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={`col-span-3 justify-start text-left font-normal ${!editingProduct.expiry_date && "text-muted-foreground"}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editingProduct.expiry_date ? format(new Date(editingProduct.expiry_date), "PPP") : <span>{t('dashboard.products.pickADate')}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editingProduct.expiry_date ? new Date(editingProduct.expiry_date) : undefined}
                      onSelect={(date) => setEditingProduct({ ...editingProduct, expiry_date: date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '' })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleUpdateProduct}>{t('dashboard.products.updateProduct')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isEditInventoryItemDialogOpen} onOpenChange={setIsEditInventoryItemDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>{t('dashboard.inventory.editInventoryItem')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.inventory.makeChanges')}
            </DialogDescription>
          </DialogHeader>
          {editingInventoryItem && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_inventory_product_name" className="text-right">
                  {t('dashboard.inventory.name')}
                </Label>
                <Input
                  id="edit_inventory_product_name"
                  value={editingInventoryItem.inventory_product_name}
                  onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, inventory_product_name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_inventory_category_name" className="text-right">
                  {t('dashboard.inventory.category')}
                </Label>
                <Select 
                  value={editingInventoryItem.inventory_category_name} 
                  onValueChange={(value) => setEditingInventoryItem({ ...editingInventoryItem, inventory_category_name: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={t('dashboard.inventory.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.category}>
                        {category.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_inventory_product_image" className="text-right">
                  {t('dashboard.inventory.image')}
                </Label>
                <Input
                  id="edit_inventory_product_image"
                  type="file"
                  onChange={handleImageChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_inventory_product_price" className="text-right">
                  {t('dashboard.inventory.price')}
                </Label>
                <Input
                  id="edit_inventory_product_price"
                  type="number"
                  value={editingInventoryItem.inventory_product_price}
                  onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, inventory_product_price: parseFloat(e.target.value) })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_inventory_product_barcode" className="text-right">
                  {t('dashboard.inventory.barcode')}
                </Label>
                <Input
                  id="edit_inventory_product_barcode"
                  value={editingInventoryItem.inventory_product_barcode}
                  onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, inventory_product_barcode: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_quantity" className="text-right">
                  {t('dashboard.inventory.quantity')}
                </Label>
                <Input
                  id="edit_quantity"
                  type="number"
                  value={editingInventoryItem.quantity}
                  onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, quantity: parseInt(e.target.value) })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_inventory_expiry_date" className="text-right">
                  {t('dashboard.inventory.expiryDate')}
                </Label>
                <Input
                  id="edit_inventory_expiry_date"
                  type="date"
                  value={editingInventoryItem.inventory_expiry_date}
                  onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, inventory_expiry_date: e.target.value })}
                  className="col-span-3"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" onClick={handleUpdateInventoryItem}>{t('dashboard.inventory.saveChanges')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isEditCategoryDialogOpen} onOpenChange={setIsEditCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('dashboard.categories.editCategory')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.categories.makeChanges')}
            </DialogDescription>
          </DialogHeader>
          {editingCategory && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_category_name" className="text-right">
                  {t('dashboard.categories.name')}
                </Label>
                <Input
                  id="edit_category_name"
                  value={editingCategory.category}
                  onChange={(e) => setEditingCategory({ ...editingCategory, category: e.target.value })}
                  className="col-span-3"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" onClick={handleUpdateCategory}>{t('dashboard.categories.saveChanges')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('common.thisActionCannotBeUndone')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteAlertOpen(false)}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    
    </div>
      {/* Füge den Footer am Ende hinzu */}
      <Footer activeView="dashboard" />
    </div>
  )
}