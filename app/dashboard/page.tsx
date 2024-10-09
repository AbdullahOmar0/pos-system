"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts'
import { CalendarIcon, DollarSign, ShoppingCart, TrendingUp, Users, Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const salesData = [
  { name: 'Jan', sales: 4000 },
  { name: 'Feb', sales: 3000 },
  { name: 'Mar', sales: 5000 },
  { name: 'Apr', sales: 4500 },
  { name: 'May', sales: 6000 },
  { name: 'Jun', sales: 5500 },
]

const productData = [
  { name: 'Coffee', sales: 4000, revenue: 10000 },
  { name: 'Tea', sales: 3000, revenue: 7500 },
  { name: 'Pastries', sales: 2000, revenue: 6000 },
  { name: 'Sandwiches', sales: 2780, revenue: 8900 },
  { name: 'Smoothies', sales: 1890, revenue: 7000 },
]

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD' }).format(value)
}

interface Product {
  id: string
  product_name: string
  category: string
  product_img_url: string
  product_stock: number
  product_barcode: string
  product_price: number
}

interface Category {
  id: string
  category: string
}

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [newProduct, setNewProduct] = useState<Product>({ 
    id: '', 
    product_name: '', 
    category: '', 
    product_img_url: '', 
    product_stock: 0,
    product_barcode: '',
    product_price: 0
  })
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchCategories()
    fetchProducts()

    const channel = supabase
      .channel('table-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'category' }, () => {
        fetchCategories()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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

  const handleAddProduct = async () => {
    if (newProduct.product_name && newProduct.category) {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          product_name: newProduct.product_name,
          category: newProduct.category,
          product_img_url: newProduct.product_img_url,
          product_stock: newProduct.product_stock,
          product_barcode: newProduct.product_barcode,
          product_price: newProduct.product_price
        }])

      if (error) {
        console.error("Error adding product:", error)
      } else {
        setNewProduct({ id: '', product_name: '', category: '', product_img_url: '', product_stock: 0, product_barcode: '', product_price: 0 })
        fetchProducts()
      }
    }
  }

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product)
    setIsEditProductDialogOpen(true)
  }

  const handleUpdateProduct = async () => {
    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update({
          product_name: editingProduct.product_name,
          category: editingProduct.category,
          product_img_url: editingProduct.product_img_url,
          product_stock: editingProduct.product_stock,
          product_barcode: editingProduct.product_barcode,
          product_price: editingProduct.product_price
        })
        .eq('id', editingProduct.id)

      if (error) {
        console.error("Error updating product:", error)
      } else {
        setIsEditProductDialogOpen(false)
        setEditingProduct(null)
        fetchProducts()
      }
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
      } else {
        setIsEditCategoryDialogOpen(false)
        setEditingCategory(null)
        fetchCategories()
      }
    }
  }

  return (
    <>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <div className="flex items-center space-x-2">
            <CalendarIcon className="mr-2 h-4 w-4" />
            <Select defaultValue="today">
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue placeholder="Select a timeframe" />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Revenue
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(45231.89)}</div>
                  <p className="text-xs text-muted-foreground">
                    +20.1% from last month
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Sales
                  </CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">+2350</div>
                  <p className="text-xs text-muted-foreground">
                    +10.5% from last month
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Users
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">+573</div>
                  <p className="text-xs text-muted-foreground">
                    +201 since last hour
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Growth Rate
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">+12.5%</div>
                  <p className="text-xs text-muted-foreground">
                    +3.1% from last month
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Monthly Sales</CardTitle>
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
                        <XAxis dataKey="name" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="sales" fill="var(--color-sales)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Top Products</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{
                    sales: {
                      label: "Sales",
                      color: "hsl(var(--chart-1))",
                    },
                    revenue: {
                      label: "Revenue",
                      color: "hsl(var(--chart-2))",
                    },
                  }} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={productData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="sales" stroke="var(--color-sales)" />
                        <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="var(--color-revenue)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Product Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Products</h3>
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
                            <Label htmlFor="product_img_url" className="text-right">
                              Image URL
                            </Label>
                            <Input
                              id="product_img_url"
                              value={newProduct.product_img_url}
                              onChange={(e) => setNewProduct({ ...newProduct, product_img_url: e.target.value })}
                              className="col-span-3"
                            />
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
                        </div>
                        <DialogFooter>
                          <Button onClick={handleAddProduct}>Save Product</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <ScrollArea className="h-[300px] w-full rounded-md border">
                    {products.map((product) => (
                      <div key={product.id} className="flex justify-between items-center p-4 border-b">
                        <div>
                          <h4 className="font-semibold">{product.product_name}</h4>
                          <p className="text-sm text-gray-500">{product.category}</p>
                          <p className="text-sm text-gray-500">Stock: {product.product_stock}</p>
                          <p className="text-sm text-gray-500">Barcode: {product.product_barcode}</p>
                          <p className="text-sm text-gray-500">Price: {formatCurrency(product.product_price)}</p>
                        </div>
                        <Button variant="outline" onClick={() => handleEditProduct(product)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Category Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Categories</h3>
                    <div className="flex space-x-2">
                      <Input
                        placeholder="New category name"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                      />
                      <Button onClick={handleAddCategory}>Add Category</Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[300px] w-full rounded-md border">
                    {categories.map((category) => (
                      <div key={category.id} className="flex justify-between items-center p-4 border-b">
                        <span>{category.category}</span>
                        <Button variant="outline" onClick={() => handleEditCategory(category)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Analytics content will be implemented here.</p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Inventory</h3>
                  </div>
                  <ScrollArea className="h-[300px] w-full rounded-md border">
                    {products.map((product) => (
                      <div key={product.id} className="flex justify-between items-center p-4 border-b">
                        <div>
                          <h4 className="font-semibold">{product.product_name}</h4>
                          <p className="text-sm text-gray-500">Stock: {product.product_stock}</p>
                          <p className="text-sm text-gray-500">Price: {formatCurrency(product.product_price)}</p>
                        </div>
                        <Button variant="outline" onClick={() => handleEditProduct(product)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

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
                <Label htmlFor="edit_product_img_url" className="text-right">
                  Image URL
                </Label>
                <Input
                  id="edit_product_img_url"
                  value={editingProduct.product_img_url}
                  onChange={(e) => setEditingProduct({ ...editingProduct, product_img_url: e.target.value })}
                  className="col-span-3"
                />
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
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleUpdateProduct}>Update Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditCategoryDialogOpen} onOpenChange={setIsEditCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category name here. Click save when you're done.
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
            <Button onClick={handleUpdateCategory}>Update Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}