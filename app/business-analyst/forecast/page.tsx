import { BusinessAnalystWorkspace } from '@/components/business-analyst-workspace'
import ForecastEvaluationPanel from '@/components/forecast-evaluation-panel'

export default function ForecastPage() {
  return (
    <>
      <BusinessAnalystWorkspace mode="forecast" />
      <ForecastEvaluationPanel />
    </>
  )
}
