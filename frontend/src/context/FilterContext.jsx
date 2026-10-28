import { createContext, useContext, useState } from 'react'

const FilterContext = createContext(null)

export function FilterProvider({ children }) {
  const [selectedYear, setSelectedYear]   = useState(null)
  const [dailyDays,    setDailyDays]      = useState(30)
  const [selectedBuildings, setSelectedBuildings] = useState([])

  return (
    <FilterContext.Provider value={{
      selectedYear, setSelectedYear,
      dailyDays,    setDailyDays,
      selectedBuildings, setSelectedBuildings,
    }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilters must be used within FilterProvider')
  return ctx
}
