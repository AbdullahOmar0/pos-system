import { createClient } from '@/utils/supabase/server'
import { PosSystem } from '@/components/pos-system'

export default async function POSPage() {
  const supabase = createClient()
  const { data: products, error } = await supabase.from("products").select()

  if (error) {
    console.error("Error fetching products:", error)
    return <div>Error loading products. Please try again later.</div>
  }

  return <PosSystem initialProducts={products} />
}


