export type TemplateDefinition = {
  key: string;
  name: string;
  category: string;
  version: number;
  description: string;
  available: boolean;
  href?: string;
};

export const templates: TemplateDefinition[] = [
  {
    key: "firearm_bill_of_sale",
    name: "Firearm Bill of Sale",
    category: "Bill of Sale",
    version: 1,
    description:
      "Private-party firearm sale record with buyer/seller roles, jurisdiction tracking, and interstate FFL workflow awareness.",
    available: true,
    href: "/new/firearm",
  },
  {
    key: "general_bill_of_sale",
    name: "General Bill of Sale",
    category: "Bill of Sale",
    version: 1,
    description: "General personal-property bill of sale for future use.",
    available: false,
  },
];

export const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
  ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"],
] as const;
