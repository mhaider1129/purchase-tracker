import React from 'react';
import {render,screen,within,cleanup} from '@testing-library/react';
import {createInstance} from 'i18next';
import {I18nextProvider} from 'react-i18next';
import Summary,{CompletionBadge,categoryLabels} from './CompletionReportingSummary';
import en from '../locales/interface.en.json';
import ar from '../locales/interface.ar.json';
async function show(node,language='en') {
 const i18n=createInstance();await i18n.init({lng:language,fallbackLng:'en',resources:{en:{interface:en},ar:{interface:ar}},defaultNS:'interface',interpolation:{escapeValue:false}});
 return render(<I18nextProvider i18n={i18n}>{node}</I18nextProvider>);
}
test('separates ordering, accepted delivery and fulfillment using the versioned server contract',async()=>{
 await show(<Summary report={{basis:'canonical_completion_v1',eligible_requests:4,procurement_complete_requests:3,receipt_complete_requests:2,fulfilled_requests:1,fulfillment_rate:25,categories:{awaiting_technical_acceptance:1}}}/>);
 for(const [label,count] of [['Procurement committed','3'],['Receiving accepted','2'],['Department fulfillment verified','1']])expect(within(screen.getByRole('group',{name:label})).getByText(count)).toBeInTheDocument();
 expect(screen.getByText(/25.0%/)).toBeInTheDocument();expect(screen.getByText(/Awaiting technical acceptance: 1/)).toBeInTheDocument();
});
test('missing or legacy metrics never become zero verified fulfillment',async()=>{
 await show(<Summary report={{completed_requests:19}}/>);expect(screen.getByRole('status')).toHaveTextContent('Verified completion unavailable');expect(screen.queryByText('0')).not.toBeInTheDocument();
});
test('badges follow the supplied category without inferring fulfillment from payment or stored status',async()=>{
 await show(<><CompletionBadge completion={{category:'awaiting_delivery',stored_status:'Completed',financial_complete:true}}/><CompletionBadge completion={{category:'awaiting_delivery'}}/></>);
 expect(screen.getAllByText('Awaiting delivery')).toHaveLength(2);expect(screen.queryByText('Fully fulfilled')).not.toBeInTheDocument();
});
test('Arabic and English render every operational category using existing catalogues',async()=>{
 for(const [locale,dict] of [['en',en],['ar',ar]]){
  await show(<>{Object.keys(categoryLabels).map(category=><CompletionBadge key={category} completion={{category}}/>)}</>,locale);
  for(const label of Object.values(categoryLabels)){expect(dict[label]).toBeTruthy();expect(screen.getByText(dict[label])).toBeInTheDocument();}
  cleanup();
 }
});
