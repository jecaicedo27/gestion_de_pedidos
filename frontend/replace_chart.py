
import os

file_path = '/var/www/gestion_de_pedidos/frontend/src/pages/ExecutiveDashboardPage.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Define the markers
start_marker = '<ScatterChart'
end_marker = '</ScatterChart>'

# Find start and end indices
start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find ScatterChart block")
    exit(1)

# Adjust end_idx to include the closing tag
end_idx = content.find('>', end_idx) + 1

# New content to insert
new_chart_code = """<BarChart
                                        data={advancedStats.data.customerClusters?.map(c => {
                                             const totalSystemOrders = advancedStats.data.customerClusters.reduce((acc, curr) => acc + (curr.totalOrders || 0), 0);
                                             const totalSystemProfit = advancedStats.data.customerClusters.reduce((acc, curr) => acc + (curr.totalProfit || 0), 0);
                                             
                                             return {
                                                 name: c.label.split(' ')[0], 
                                                 'Esfuerzo Logístico (% Pedidos)': totalSystemOrders > 0 ? (c.totalOrders / totalSystemOrders) * 100 : 0,
                                                 'Recompensa Financiera (% Ganancia)': totalSystemProfit > 0 ? (c.totalProfit / totalSystemProfit) * 100 : 0
                                             };
                                        })}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis unit="%" />
                                        <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                                        <Legend />
                                        <Bar dataKey="Esfuerzo Logístico (% Pedidos)" fill="#EF4444" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Recompensa Financiera (% Ganancia)" fill="#10B981" radius={[4, 4, 0, 0]} />
                                    </BarChart>"""

# Perform replacement
new_content = content[:start_idx] + new_chart_code + content[end_idx:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully replaced ScatterChart with BarChart")
