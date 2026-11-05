import { DEMO_INVESTOR_IDS } from '@cap-event/contracts';

import { fnv1a } from '../common/utils/hash.util';

/**
 * SIMULATION ONLY. A fixed pool of demo investors (ids shared with
 * reference-data-service's investor attributes). Each entity gets a
 * deterministic subset with deterministic commitment / invested capital, so
 * allocate, process and the mgmt-fee preview always agree with each other.
 * These are NOT the real business rules.
 */
interface InvestorTemplate {
  customerId: (typeof DEMO_INVESTOR_IDS)[number];
  investor: string;
  customerName: string;
  classID: string;
  additionalInvestorType: string;
  department: string;
  location: string;
  baseCommitment: number;
}

const POOL: InvestorTemplate[] = [
  {
    customerId: 'CUST001',
    investor: 'ABC Pension Fund',
    customerName: 'ABC Pension Fund LLC',
    classID: 'LP',
    additionalInvestorType: 'Institutional',
    department: 'Private Equity',
    location: 'New York',
    baseCommitment: 5_000_000,
  },
  {
    customerId: 'CUST002',
    investor: 'XYZ Family Office',
    customerName: 'XYZ Family Office Ltd',
    classID: 'LP',
    additionalInvestorType: 'Private Wealth',
    department: 'Alternative Investments',
    location: 'California',
    baseCommitment: 2_000_000,
  },
  {
    customerId: 'CUST003',
    investor: 'Evergreen Endowment',
    customerName: 'Evergreen University Endowment',
    classID: 'LP',
    additionalInvestorType: 'Endowment',
    department: 'Investments',
    location: 'Massachusetts',
    baseCommitment: 8_000_000,
  },
  {
    customerId: 'CUST004',
    investor: 'Harbor Insurance Co',
    customerName: 'Harbor Mutual Insurance Company',
    classID: 'LP',
    additionalInvestorType: 'Insurance',
    department: 'Treasury',
    location: 'Connecticut',
    baseCommitment: 6_500_000,
  },
  {
    customerId: 'CUST005',
    investor: 'Summit Sovereign Fund',
    customerName: 'Summit Sovereign Wealth Fund',
    classID: 'LP',
    additionalInvestorType: 'Sovereign',
    department: 'External Managers',
    location: 'Singapore',
    baseCommitment: 12_000_000,
  },
  {
    customerId: 'CUST006',
    investor: 'Lakeside Foundation',
    customerName: 'Lakeside Community Foundation',
    classID: 'LP',
    additionalInvestorType: 'Foundation',
    department: 'Finance',
    location: 'Illinois',
    baseCommitment: 1_500_000,
  },
  {
    customerId: 'CUST007',
    investor: 'Meridian Fund of Funds',
    customerName: 'Meridian FoF Partners LP',
    classID: 'LP',
    additionalInvestorType: 'Fund of Funds',
    department: 'Portfolio',
    location: 'Texas',
    baseCommitment: 3_000_000,
  },
  {
    customerId: 'CUST008',
    investor: 'Orchid GP Commitment',
    customerName: 'Orchid GP Affiliate LLC',
    classID: 'GP',
    additionalInvestorType: 'GP Affiliate',
    department: 'Principals',
    location: 'Delaware',
    baseCommitment: 800_000,
  },
];

export interface RosterInvestor extends Omit<
  InvestorTemplate,
  'baseCommitment'
> {
  commitment: number;
  investedCapital: number;
  unfunded: number;
  /** Share of invested capital that is "deal" capital (for the Contribution - Deal basis). */
  dealFactor: number;
  managementFee: number;
  managementFeePercentage: number;
}

const INVESTORS_PER_ENTITY = 6;
const MANAGEMENT_FEE_PERCENTAGE = 2;

export const rosterForEntity = (entityId: string): RosterInvestor[] => {
  const h = fnv1a(entityId);
  const skipA = h % POOL.length;
  const skipB =
    (skipA + 1 + (Math.floor(h / 7) % (POOL.length - 1))) % POOL.length;
  return POOL.filter((_, i) => i !== skipA && i !== skipB)
    .slice(0, INVESTORS_PER_ENTITY)
    .map(({ baseCommitment, ...investor }) => {
      const hi = fnv1a(`${entityId}:${investor.customerId}`);
      const commitment =
        Math.round((baseCommitment * (0.6 + (hi % 81) / 100)) / 1000) * 1000;
      const investedCapital = Math.round(
        commitment * (0.35 + ((hi >>> 8) % 40) / 100),
      );
      return {
        ...investor,
        commitment,
        investedCapital,
        unfunded: commitment - investedCapital,
        dealFactor: 0.5 + ((hi >>> 16) % 50) / 100,
        managementFee: Math.round(
          (commitment * MANAGEMENT_FEE_PERCENTAGE) / 100 / 4,
        ),
        managementFeePercentage: MANAGEMENT_FEE_PERCENTAGE,
      };
    });
};

/** Allocation basis ids the UI knows (and reference-data-service seeds). */
export const BASIS = {
  COMMITMENT: 'DS-CMNT',
  UNFUNDED: 'DS-UNFNDCMNT',
  CONTRIBUTION_ALL: 'DS-CNTRAll',
  CONTRIBUTION_DEAL: 'DS-CNTRDeal',
  NON_DOMINANT: 'DS-NONDMNT',
} as const;

export const BASIS_NAME_TO_ID: Record<string, string> = {
  commitment: BASIS.COMMITMENT,
  'unfunded commitment': BASIS.UNFUNDED,
  'contribution - all': BASIS.CONTRIBUTION_ALL,
  'contribution - deal': BASIS.CONTRIBUTION_DEAL,
  'non-dominant': BASIS.NON_DOMINANT,
};

/** Resolves a basis id, falling back to its (case-insensitive) name. Unknown -> undefined. */
export const resolveBasisId = (
  id?: string,
  name?: string,
): string | undefined => {
  if (id && Object.values<string>(BASIS).includes(id)) return id;
  return name ? BASIS_NAME_TO_ID[name.trim().toLowerCase()] : undefined;
};

/**
 * Weight of every investor under a basis. Unknown basis -> equal weights
 * (documented simplification).
 */
export const weightsFor = (
  basisId: string | undefined,
  roster: RosterInvestor[],
): number[] => {
  switch (basisId) {
    case BASIS.COMMITMENT:
      return roster.map((i) => i.commitment);
    case BASIS.UNFUNDED:
      return roster.map((i) => i.unfunded);
    case BASIS.CONTRIBUTION_ALL:
      return roster.map((i) => i.investedCapital);
    case BASIS.CONTRIBUTION_DEAL:
      return roster.map((i) => i.investedCapital * i.dealFactor);
    case BASIS.NON_DOMINANT: {
      const dominant = Math.max(...roster.map((i) => i.commitment));
      let skipped = false;
      return roster.map((i) => {
        if (!skipped && i.commitment === dominant) {
          skipped = true;
          return 0;
        }
        return i.commitment;
      });
    }
    default:
      return roster.map(() => 1);
  }
};
