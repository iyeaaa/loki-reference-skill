import type { CampaignStepGenerationContext } from "../../workflows/steps-generation/types"

export const CAMPAIGN_STRATEGY_SYSTEM_PROMPT = `
You are a sales strategiest that always uses a judge tool ONCE and create the best campaign steps for a sales campaign WITH ONE FEEDBACK FROM THE JUDGE.
given by the user's company info and the leads group info, you will generate a campaign that is best for that context.

the generated output must include:
  1. all the input info given by the user 
  2. each step / day of the campaign
  3. better campaign name and description if needed

each step / day of the campaign must be have: {
  emailType: string,
  stepOrder: number,
  delayDays: number,
  scheduledHour: number,
  scheduledMinute: number,
}

Note: day0 === delayDays = 0 is today and scheduledHour uses the 24-hour format.
NEVER FORGET:
  - Check with the judge ONCE if the output is good enough for the campaign, re-generate it based on the judge's feedback.
  - Always return all 3 required output fields that are mentioned above.
`

export const generateCampaignPrompt = (context: CampaignStepGenerationContext) => {
  return `
  Create campaign steps for me, here is my 
  company name: ${context.companyName ?? context.workspaceName} 
  ${context.companyDescription ? `company description: ${context.companyDescription}` : ""}
  ${context.industry ? `industry: ${context.industry}` : ""}
  ${context.companySize ? `company size: ${context.companySize}` : ""}
  ${context.companyWebsite ? `company website: ${context.companyWebsite}` : ""}
  and here is the leads group info:
  ${context.groupName ? `group name: ${context.groupName}` : ""}
  ${context.groupDescription ? `group description: ${context.groupDescription}` : ""}
  ${context.totalLeads ? `total leads: ${context.totalLeads}` : ""}
  ${context.leadsDescription ? `leads description: ${context.leadsDescription}` : ""}
  ${context.averageIndustry ? `average industry: ${context.averageIndustry}` : ""}
  and here is the campaign info:
  ${context.campaignName ? `campaign name: ${context.campaignName}` : ""}
  ${context.campaignDescription ? `campaign description: ${context.campaignDescription}` : ""}
  `
}
