"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { CalendarIcon, DollarSign, ShoppingCart, TrendingUp, Users, Plus, Pencil, Trash2, Upload, MoreHorizontal, Search, Settings } from 'lucide-react'
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
  id: string
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
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
  const [newInventoryItem, setNewInventoryItem] = useState<InventoryItem>({
    id: '',
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
  const [dateRange, setDateRange] = useState<{from: Date | undefined, to: Date | undefined}>({
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
    if (newInventoryItem.inventory_product_name && newInventoryItem.inventory_category_name) {
      let imagePath = '';
      if (selectedImage) {
        try {
          const { data, error } = await supabase.storage
            .from('product_images')  // Changed from 'inventory_images' to 'product_images'
            .upload(`inventory_${Date.now()}_${selectedImage.name}`, selectedImage);

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
          .from('inventory')
          .insert([{
            inventory_product_name: newInventoryItem.inventory_product_name,
            inventory_category_name: newInventoryItem.inventory_category_name,
            inventory_product_img_path: imagePath,
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
            id: '',
            inventory_product_name: '',
            inventory_category_name: '',
            inventory_product_img_path: '',
            inventory_product_price: 0,
            inventory_product_barcode: '',
            quantity: 0,
            inventory_expiry_date: ''
          });
          setSelectedImage(null);
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
        .eq('id', editingInventoryItem.id)

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

  const handleDeleteItem = async () => {
    if (itemToDelete) {
      const { id, type } = itemToDelete
      const { error } = await supabase
        .from(type === 'product' ? 'products' : type === 'category' ? 'category' : 'inventory')
        .delete()
        .eq('id', id)

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
    } else if (isSameDay(dateRange.from, startOfWeek(dateRange.from)) && isSameDay(dateRange.to || dateRange.from, endOfWeek(dateRange.from))) {
      setDateRangeLabel("This Week")
    } else if (isSameDay(dateRange.from, startOfMonth(dateRange.from)) && isSameDay(dateRange.to || dateRange.from, endOfMonth(dateRange.from))) {
      setDateRangeLabel("This Month")
    } else if (isSameDay(dateRange.from, startOfYear(dateRange.from)) && isSameDay(dateRange.to || dateRange.from, endOfYear(dateRange.from))) {
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

  const filteredInventory = inventoryItems.filter((item) => {
    const matchesSearch = item.inventory_product_name.toLowerCase().includes(inventorySearchTerm.toLowerCase())
    const matchesCategory = inventoryCategoryFilter === 'all' || item.inventory_category_name === inventoryCategoryFilter
    const matchesStock = inventoryStockFilter === 'all' || 
      (inventoryStockFilter === 'low' && item.quantity < 10) ||
      (inventoryStockFilter === 'medium' && item.quantity >= 10 && item.quantity < 50) ||
      (inventoryStockFilter === 'high' && item.quantity >= 50)

    return matchesSearch && matchesCategory && matchesStock
  })

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      {/* Kopfzeile des Dashboards */}
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={`w-[300px] justify-start text-left font-normal`}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {getDateRangeText()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Select onValueChange={setPresetRange}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select a preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
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
        </div>
      </div>
      {/* Tabs für verschiedene Bereiche des Dashboards */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>
         {/* overview-Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Karten für Gesamtumsatz, Verkäufe, Kunden und durchschnittlichen Bestellwert */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Revenue ({dateRangeLabel})
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                  +20% from previous period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Sales ({dateRangeLabel})
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+{totalSales}</div>
                <p className="text-xs text-muted-foreground">
                  +180.1% from previous period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Customers ({dateRangeLabel})
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+{totalCustomers}</div>
                <p className="text-xs text-muted-foreground">
                  +19% from previous period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Average Order Value ({dateRangeLabel})
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(averageOrderValue)}</div>
                <p className="text-xs text-muted-foreground">
                  +201 from previous period
                </p>
              </CardContent>
            </Card>
          </div>
           {/* Diagramme für Verkaufsübersicht und Top-Produkte */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Sales Overview ({dateRangeLabel})</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <ChartContainer config={{
                  sales: {
                    label: "Sales",
                    color: "hsl(var(--chart-1))",
                  },
                }} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="total" fill="var(--color-sales)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Top Products ({dateRangeLabel})</CardTitle>
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
                      <BarChart data={topProducts} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="product_name" type="category" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="total_sold" fill="var(--color-sales)" />
                      </BarChart>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No data available for the selected period</p>
                      </div>
                    )}
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* products-Tab */}
        <TabsContent value="products">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-2xl font-bold">Products</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage your products and view their sales performance.
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsFiltersVisible(!isFiltersVisible)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Filter
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[625px]">
                    <DialogHeader>
                      <DialogTitle>Add New Product</DialogTitle>
                      <DialogDescription>
                        Create a new product here. Click save when you're done.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="product_name" className="text-right">
                          Name
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
                          Category
                        </Label>
                        <Select 
                          value={newProduct.category} 
                          onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select category" />
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
                          Product Image
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
                          Stock
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
                          Barcode
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
                          Price
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
                          Expiry Date
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
                              {newProduct.expiry_date ? format(new Date(newProduct.expiry_date), "PPP") : <span>Pick a date</span>}
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
                      <Button onClick={handleAddProduct}>Save Product</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isFiltersVisible && (
                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="search">Search</Label>
                    <Input
                      id="search"
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category-filter">Category</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger id="category-filter">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.category}>
                            {category.category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="expiry-status-filter">Expiry Status</Label>
                    <Select value={expiryStatusFilter} onValueChange={setExpiryStatusFilter}>
                      <SelectTrigger id="expiry-status-filter">
                        <SelectValue placeholder="Select expiry status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Expired">Expired</SelectItem>
                        <SelectItem value="Expires today">Expires Today</SelectItem>
                        <SelectItem value="days">Not Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="stock-filter">Stock Level</Label>
                    <Select value={stockFilter} onValueChange={setStockFilter}>
                      <SelectTrigger id="stock-filter">
                        <SelectValue placeholder="Select stock level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="low">Low Stock (&lt;10)</SelectItem>
                        <SelectItem value="medium">Medium Stock (10-50)</SelectItem>
                        <SelectItem value="high">High Stock (&gt;50)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                  <TableHead className="w-[80px]"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Expiry Status</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredProducts.map((product) => {
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
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setItemToDelete({ id: product.id, type: 'product' })
                                  setIsDeleteAlertOpen(true)
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Kategorien-Tab */}
        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-2xl font-bold">Categories</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage your product categories.
                </p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Category
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Category</DialogTitle>
                    <DialogDescription>
                      Create a new category here. Click save when you're done.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="category_name" className="text-right">
                        Name
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
                    <Button type="submit" onClick={handleAddCategory}>Save Category</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.category}</TableCell>
                      <TableCell className="text-right">
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
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setItemToDelete({ id: category.id, type: 'category' })
                              setIsDeleteAlertOpen(true)
                            }}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Analyse-Tab */}
        <TabsContent value="analytics">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Revenue ({dateRangeLabel})
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                  +20% from previous period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Sales ({dateRangeLabel})
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+{totalSales}</div>
                <p className="text-xs text-muted-foreground">
                  +180.1% from previous period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Customers ({dateRangeLabel})
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+{totalCustomers}</div>
                <p className="text-xs text-muted-foreground">
                  +19% from previous period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Average Order Value ({dateRangeLabel})
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(averageOrderValue)}</div>
                <p className="text-xs text-muted-foreground">
                  +201 from previous period
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Sales Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{
                  sales: {
                    label: "Sales",
                    color: "hsl(var(--chart-1))",
                  },
                }} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="total" stroke="var(--color-sales)" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Top Selling Products</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{
                  sales: {
                    label: "Sales",
                    color: "hsl(var(--chart-1))",
                  },
                }} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="product_name" type="category" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="total_sold" fill="var(--color-sales)" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Sales by Category ({dateRangeLabel})</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{
                  category: {
                    label: "Category",
                    color: "hsl(var(--chart-1))",
                  },
                }} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {salesByCategory.length > 0 ? (
                      <PieChart>
                        <Pie
                          data={salesByCategory}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {salesByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No data available for the selected period</p>
                      </div>
                    )}
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Key Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium">Total Revenue</h4>
                    <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Average Order Value</h4>
                    <p className="text-2xl font-bold">{formatCurrency(averageOrderValue)}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Total Orders</h4>
                    <p className="text-2xl font-bold">{totalSales}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* inventory-Tab */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-2xl font-bold">Inventory</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage your inventory and stock levels.
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsInventoryFiltersVisible(!isInventoryFiltersVisible)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Filter
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Inventory Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[625px]">
                    <DialogHeader>
                      <DialogTitle>Add New Inventory Item</DialogTitle>
                      <DialogDescription>
                        Create a new inventory item here. Click save when you're done.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="inventory_product_name" className="text-right">
                          Name
                        </Label>
                        <Input
                          id="inventory_product_name"
                          value={newInventoryItem.inventory_product_name}
                          onChange={(e) => setNewInventoryItem({ ...newInventoryItem, inventory_product_name: e.target.value })}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="inventory_category_name" className="text-right">
                          Category
                        </Label>
                        <Select 
                          value={newInventoryItem.inventory_category_name} 
                          onValueChange={(value) => setNewInventoryItem({ ...newInventoryItem, inventory_category_name: value })}
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select a category" />
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
                        <Label htmlFor="inventory_product_image" className="text-right">
                          Image
                        </Label>
                        <Input
                          id="inventory_product_image"
                          type="file"
                          onChange={handleImageChange}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="inventory_product_price" className="text-right">
                          Price
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
                        <Label htmlFor="inventory_product_barcode" className="text-right">
                          Barcode
                        </Label>
                        <Input
                          id="inventory_product_barcode"
                          value={newInventoryItem.inventory_product_barcode}
                          onChange={(e) => setNewInventoryItem({ ...newInventoryItem, inventory_product_barcode: e.target.value })}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="quantity" className="text-right">
                          Quantity
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
                          Expiry Date
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
                      <Button type="submit" onClick={handleAddInventoryItem}>Save Inventory Item</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isInventoryFiltersVisible && (
                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="inventory-search">Search</Label>
                    <Input
                      id="inventory-search"
                      placeholder="Search inventory..."
                      value={inventorySearchTerm}
                      onChange={(e) => setInventorySearchTerm(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="inventory-category-filter">Category</Label>
                    <Select value={inventoryCategoryFilter} onValueChange={setInventoryCategoryFilter}>
                      <SelectTrigger id="inventory-category-filter">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.category}>
                            {category.category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="inventory-stock-filter">Stock Level</Label>
                    <Select value={inventoryStockFilter} onValueChange={setInventoryStockFilter}>
                      <SelectTrigger id="inventory-stock-filter">
                        <SelectValue placeholder="Select stock level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="low">Low Stock (&lt;10)</SelectItem>
                        <SelectItem value="medium">Medium Stock (10-50)</SelectItem>
                        <SelectItem value="high">High Stock (&gt;50)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item) => (
                    <TableRow key={item.id}>
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
                            No Image
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
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setItemToDelete({ id: item.id, type: 'inventory' })
                              setIsDeleteAlertOpen(true)
                            }}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={isEditProductDialogOpen} onOpenChange={setIsEditProductDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update the product details here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_product_name" className="text-right">
                  Name
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
                  Category
                </Label>
                <Select 
                  value={editingProduct.category} 
                  onValueChange={(value) => setEditingProduct({ ...editingProduct, category: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select category" />
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
                  Product Image
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
                  Stock
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
                  Barcode
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
                  Price
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
                  Expiry Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={`col-span-3 justify-start text-left font-normal ${!editingProduct.expiry_date && "text-muted-foreground"}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editingProduct.expiry_date ? format(new Date(editingProduct.expiry_date), "PPP") : <span>Pick a date</span>}
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
            <Button onClick={handleUpdateProduct}>Update Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isEditInventoryItemDialogOpen} onOpenChange={setIsEditInventoryItemDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>
              Make changes to the inventory item here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          {editingInventoryItem && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_inventory_product_name" className="text-right">
                  Name
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
                  Category
                </Label>
                <Select 
                  value={editingInventoryItem.inventory_category_name} 
                  onValueChange={(value) => setEditingInventoryItem({ ...editingInventoryItem, inventory_category_name: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a category" />
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
                  Image
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
                  Price
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
                  Barcode
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
                  Quantity
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
                  Expiry Date
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
            <Button type="submit" onClick={handleUpdateInventoryItem}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isEditCategoryDialogOpen} onOpenChange={setIsEditCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Make changes to the category here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          {editingCategory && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_category_name" className="text-right">
                  Name
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
            <Button type="submit" onClick={handleUpdateCategory}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {itemToDelete?.type}
              and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteAlertOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}