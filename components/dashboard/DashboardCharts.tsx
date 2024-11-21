import React from 'react'
import { ChartContainer } from "@/components/ui/chart"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

interface DashboardChartsProps {
  salesData: any[]
}

const DashboardCharts = ({ salesData }: DashboardChartsProps) => {
  return (
    <ChartContainer config={{
      sales: {
        label: "Sales",
        color: "hsl(var(--chart-1))",
      },
    }}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={salesData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="total" stroke="var(--color-sales)" />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

export default DashboardCharts 