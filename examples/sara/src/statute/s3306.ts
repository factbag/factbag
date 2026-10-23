/**
 * §3306. Definitions for the unemployment tax: employer (a), wages (b) and employment (c);
 * and §3301, the tax itself. Services and payments are the text's facts about pairs of
 * people: who employed whom, for what kind of work, where, and what was paid, when and in
 * what medium. An undated payment is taken to be made when the work ended, as the
 * reference formalization dates it.
 */
import {
  and,
  closedPredicate,
  count,
  daysBetween,
  div,
  floorTo,
  gt,
  gte,
  letIn,
  lte,
  min,
  mul,
  not,
  or,
  roundTo,
  sub,
  sum,
  variable,
  yearsBetween,
} from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { day } from "../calendar";
import {
  admitted_alien_farm_worker,
  agricultural_labor,
  american_employer,
  born,
  child_of,
  committed_to_penal_institution,
  died,
  domestic_service,
  employed,
  employed_on,
  enrolled_at_nursing_school,
  enrolled_at_school,
  hospital_patient,
  paid,
  paid_in,
  paid_in_kind,
  paid_into_plan,
  paid_on,
  paid_under_employer_plan,
  Person,
  service_abroad,
  service_outside_business,
  termination_payment,
  us_citizen,
  works_for_institution,
  year_bounds,
} from "../schema";
import { spouses } from "./helpers";
import { dependent_of } from "./s152";

const E = variable("E");
const P = variable("P");
const S = variable("S");
const Y = variable("Y");
const Y1 = variable("Y1");
const A = variable("A");
const D = variable("D");
const F = variable("F");
const L = variable("L");
const F1 = variable("F1");
const L1 = variable("L1");
const B = variable("B");
const W = variable("W");
const N = variable("N");
const T = variable("T");
const C = variable("C");
const X = variable("X");

/** A Monday, from which weeks are counted: the first of January 1900. */
const MONDAY = day("1900-01-01");

const pair = { employer: Person, employee: Person };
const pairYear = { ...pair, year: BigInt };
const employerYear = { employer: Person, year: BigInt };
const payment = { payer: Person, payee: Person, year: BigInt };

// --- Services and payments ---

/** The employee performed some service for the employer, on any terms the text gives. */
export const service = closedPredicate("service", pair);
const employed_ended_before = closedPredicate("employed_ended_before", { ...pair, day: Date });
const has_employed_since = closedPredicate("has_employed_since", pair);
const has_employed_until = closedPredicate("has_employed_until", pair);
/** The employee worked for the employer at some time during the year. */
export const employed_in = closedPredicate("employed_in", pairYear);
/** The year the text puts the service in, for dating a payment it does not date. */
const service_year = closedPredicate("service_year", pairYear);
const dated_payment = closedPredicate("dated_payment", {
  payer: Person,
  payee: Person,
  amount: Number,
});
/** A payment of the amount by the payer to the payee in the year. */
export const payment_in = closedPredicate("payment_in", { ...payment, amount: Number });
/** The service was agricultural labor, domestic service, or neither. */
const agricultural = closedPredicate("agricultural", pair);
const domestic = closedPredicate("domestic", pair);
const general = closedPredicate("general", pair);
/** A payment for the kind of service, cash or not, in the year or the year before. */
const general_pay = closedPredicate("general_pay", { ...payment, amount: Number });
const agricultural_cash = closedPredicate("agricultural_cash", { ...payment, amount: Number });
const domestic_cash = closedPredicate("domestic_cash", { ...payment, amount: Number });
const general_pay_window = closedPredicate("general_pay_window", { ...payment, amount: Number });
const agricultural_cash_window = closedPredicate("agricultural_cash_window", {
  ...payment,
  amount: Number,
});
const domestic_cash_window = closedPredicate("domestic_cash_window", {
  ...payment,
  amount: Number,
});
/** The day lies in the year or the year before. */
const day_in_window = closedPredicate("day_in_window", { day: Date, year: BigInt });
/** A day on which the employer employed at least one person in general service. */
const general_day = closedPredicate("general_day", { employer: Person, day: Date });
/** A day on which the employer employed at least five people in agricultural labor. */
const agricultural_day = closedPredicate("agricultural_day", { employer: Person, day: Date });
/** The weeks, counted from a Monday, of such days in the year or the year before. */
const general_week = closedPredicate("general_week", { ...employerYear, week: Number });
const agricultural_week = closedPredicate("agricultural_week", { ...employerYear, week: Number });

// --- (a) Employer ---

/** (a)(1)(A): paid $1,500 or more of wages, other than agricultural or domestic, in the year or the year before. */
export const s3306_a_1_A = closedPredicate("s3306_a_1_A", employerYear);
/** (a)(1)(B): employed someone on ten days in ten different weeks of the year or the year before. */
export const s3306_a_1_B = closedPredicate("s3306_a_1_B", employerYear);
/** (a)(1): an employer in general. */
export const s3306_a_1 = closedPredicate("s3306_a_1", employerYear);
/** (a)(2)(A): paid $20,000 or more of wages for agricultural labor in the year or the year before. */
export const s3306_a_2_A = closedPredicate("s3306_a_2_A", employerYear);
/** (a)(2)(B): employed five or more in agricultural labor on ten days in ten different weeks. */
export const s3306_a_2_B = closedPredicate("s3306_a_2_B", employerYear);
/** (a)(2): an employer of agricultural labor. */
export const s3306_a_2 = closedPredicate("s3306_a_2", employerYear);
/** (a)(3): paid $1,000 or more in cash for domestic service in the year or the year before. */
export const s3306_a_3 = closedPredicate("s3306_a_3", employerYear);
/** (a): an employer for the year, under (1), (2) or (3). */
export const s3306_a = closedPredicate("s3306_a", employerYear);

// --- (c) Employment ---

/** (c)(A): service performed within the United States. */
export const s3306_c_A = closedPredicate("s3306_c_A", pair);
/** (c)(B): service outside the United States by a citizen for an American employer. */
export const s3306_c_B = closedPredicate("s3306_c_B", pair);
/** (c)(1)(A)(i): the employer paid $20,000 or more in cash for agricultural labor. */
export const s3306_c_1_A_i = closedPredicate("s3306_c_1_A_i", pairYear);
/** (c)(1)(A)(ii): the employer had five or more in agricultural labor on ten days in ten weeks. */
export const s3306_c_1_A_ii = closedPredicate("s3306_c_1_A_ii", pairYear);
/** (c)(1)(A): either. */
export const s3306_c_1_A = closedPredicate("s3306_c_1_A", pairYear);
/** (c)(1)(B): the labor is not by an alien admitted to perform agricultural labor. */
export const s3306_c_1_B = closedPredicate("s3306_c_1_B", pair);
const s3306_c_1_A_and_B = closedPredicate("s3306_c_1_A_and_B", pairYear);
/** (c)(1): agricultural labor is not employment, unless (A) and (B). */
export const s3306_c_1 = closedPredicate("s3306_c_1", pairYear);
/** (c)(2): domestic service is not employment, unless the employer paid $1,000 in cash for it. */
export const s3306_c_2 = closedPredicate("s3306_c_2", pairYear);
/** (c)(5)(A): service in the employ of one's son, daughter or spouse. */
export const s3306_c_5_A = closedPredicate("s3306_c_5_A", pair);
/** (c)(5)(B): service by a child under 21 in the employ of a parent. */
export const s3306_c_5_B = closedPredicate("s3306_c_5_B", pairYear);
/** (c)(5): either. */
export const s3306_c_5 = closedPredicate("s3306_c_5", pairYear);
/** (c)(6), (7), (11), (16): service in the employ of a government or international organization. */
export const s3306_c_6 = closedPredicate("s3306_c_6", { employee: Person, year: BigInt });
export const s3306_c_7 = closedPredicate("s3306_c_7", { employee: Person, year: BigInt });
export const s3306_c_11 = closedPredicate("s3306_c_11", { employee: Person, year: BigInt });
export const s3306_c_16 = closedPredicate("s3306_c_16", { employee: Person, year: BigInt });
/** (c)(10)(A)(i): service for a school by a student enrolled and attending there. */
export const s3306_c_10_A_i = closedPredicate("s3306_c_10_A_i", { employee: Person, year: BigInt });
/** (c)(10)(A)(ii): service for a school by the spouse of such a student. */
export const s3306_c_10_A_ii = closedPredicate("s3306_c_10_A_ii", {
  employee: Person,
  year: BigInt,
});
/** (c)(10)(A): either. */
export const s3306_c_10_A = closedPredicate("s3306_c_10_A", { employee: Person, year: BigInt });
/** (c)(10)(B): service for a hospital by a patient of it. */
export const s3306_c_10_B = closedPredicate("s3306_c_10_B", { employee: Person, year: BigInt });
/** (c)(10): either. */
export const s3306_c_10 = closedPredicate("s3306_c_10", { employee: Person, year: BigInt });
/** (c)(13): service as a student nurse for a hospital or nurses' training school. */
export const s3306_c_13 = closedPredicate("s3306_c_13", { employee: Person, year: BigInt });
/** (c)(21): service by a person committed to a penal institution. */
export const s3306_c_21 = closedPredicate("s3306_c_21", { employee: Person, year: BigInt });
/** The person was enrolled at a school at some time in the year, and so on for the other states. */
const enrolled_in = closedPredicate("enrolled_in", { person: Person, year: BigInt });
const nursing_enrolled_in = closedPredicate("nursing_enrolled_in", {
  person: Person,
  year: BigInt,
});
const patient_in = closedPredicate("patient_in", { person: Person, year: BigInt });
const committed_in = closedPredicate("committed_in", { person: Person, year: BigInt });
/** (c): the employee's service for the employer in the year is employment. */
export const s3306_c = closedPredicate("s3306_c", pairYear);

// --- (b) Wages ---

/** (b)(2)(A): a payment under a plan for sickness or accident disability, for an employee or dependent. */
export const s3306_b_2_A = closedPredicate("s3306_b_2_A", payment);
/** (b)(2)(C): the same for death. */
export const s3306_b_2_C = closedPredicate("s3306_b_2_C", payment);
/** (b)(2): either. */
export const s3306_b_2 = closedPredicate("s3306_b_2", payment);
/** The payee is the employee or a dependent of the employee, for the payer's service. */
const employee_or_dependent = closedPredicate("employee_or_dependent", payment);
/** (b)(7): remuneration in kind for service outside the employer's trade or business. */
export const s3306_b_7 = closedPredicate("s3306_b_7", { payer: Person, payee: Person });
/** (b)(10)(A): a payment upon or after termination because of death or retirement for disability. */
export const s3306_b_10_A = closedPredicate("s3306_b_10_A", {
  payer: Person,
  year: BigInt,
  amount: Number,
});
/** (b)(10)(B): a payment under a plan the employer established for employees generally. */
export const s3306_b_10_B = closedPredicate("s3306_b_10_B", {
  payer: Person,
  year: BigInt,
  amount: Number,
});
/** (b)(10): both. */
export const s3306_b_10 = closedPredicate("s3306_b_10", {
  payer: Person,
  year: BigInt,
  amount: Number,
});
/** The payer made a payment of the amount in the year, to anyone. */
const paid_amount_in = closedPredicate("paid_amount_in", {
  payer: Person,
  year: BigInt,
  amount: Number,
});
/** (b)(11): remuneration for agricultural labor paid in kind. */
export const s3306_b_11 = closedPredicate("s3306_b_11", payment);
/** (b)(15): a payment to a survivor of a former employee after the year of the death. */
export const s3306_b_15 = closedPredicate("s3306_b_15", payment);
/** (b): what the payer paid the payee in the year is wages: for employment, and not excluded. */
export const s3306_b = closedPredicate("s3306_b", payment);
/** A payment by the payer to the payee in the year, excluded under (b)(10) by its amount. */
const excluded_b_10 = closedPredicate("excluded_b_10", payment);

// --- §3301 ---

/** Wages paid to one employee in the year, capped at $7,000 under (b)(1). */
const capped_wages = closedPredicate("capped_wages", { ...payment, amount: Number });
/** Total wages the employer paid in the year with respect to employment. */
export const total_wages = closedPredicate("total_wages", {
  employer: Person,
  year: BigInt,
  amount: Number,
});
/** §3301: the tax, 6 percent of total wages, on an employer under (a). */
export const s3301 = closedPredicate("s3301", { employer: Person, year: BigInt, amount: Number });

export function defineS3306(kb: KnowledgeBase): void {
  // Services.
  kb.rule(service({ employer: E, employee: P })).iff(
    or(
      employed.undated({ employer: E, employee: P }),
      employed.inYear({ employer: E, employee: P, year: Y }),
      employed.since({ employer: E, employee: P, day: D }),
      employed.until({ employer: E, employee: P, day: D }),
      employed_on({ employer: E, employee: P, day: D }),
      paid({ payer: E, payee: P, amount: A }),
      paid_in({ payer: E, payee: P, amount: A, year: Y }),
      paid_on({ payer: E, payee: P, amount: A, day: D }),
    ),
  );
  kb.rule(employed_ended_before({ employer: E, employee: P, day: D })).iff(
    and(employed.until({ employer: E, employee: P, day: X }), gt(D, X)),
  );
  kb.rule(has_employed_since({ employer: E, employee: P })).iff(
    employed.since({ employer: E, employee: P, day: D }),
  );
  kb.rule(has_employed_until({ employer: E, employee: P })).iff(
    employed.until({ employer: E, employee: P, day: D }),
  );
  kb.rule(employed_in({ employer: E, employee: P, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      or(
        employed.inYear({ employer: E, employee: P, year: Y }),
        and(
          employed.since({ employer: E, employee: P, day: D }),
          lte(D, L),
          not(employed_ended_before({ employer: E, employee: P, day: F })),
        ),
        and(
          employed.until({ employer: E, employee: P, day: D }),
          gte(D, F),
          not(has_employed_since({ employer: E, employee: P })),
        ),
        and(employed_on({ employer: E, employee: P, day: D }), gte(D, F), lte(D, L)),
      ),
    ),
  );
  kb.rule(service_year({ employer: E, employee: P, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      or(
        and(employed.until({ employer: E, employee: P, day: D }), gte(D, F), lte(D, L)),
        and(
          not(has_employed_until({ employer: E, employee: P })),
          employed.inYear({ employer: E, employee: P, year: Y }),
        ),
        and(
          not(has_employed_until({ employer: E, employee: P })),
          employed.since({ employer: E, employee: P, day: D }),
          gte(D, F),
          lte(D, L),
        ),
        and(
          not(has_employed_until({ employer: E, employee: P })),
          employed_on({ employer: E, employee: P, day: D }),
          gte(D, F),
          lte(D, L),
        ),
      ),
    ),
  );
  kb.rule(dated_payment({ payer: E, payee: P, amount: A })).iff(
    or(
      paid_in({ payer: E, payee: P, amount: A, year: Y }),
      paid_on({ payer: E, payee: P, amount: A, day: D }),
    ),
  );
  kb.rule(payment_in({ payer: E, payee: P, amount: A, year: Y })).iff(
    or(
      paid_in({ payer: E, payee: P, amount: A, year: Y }),
      and(
        paid_on({ payer: E, payee: P, amount: A, day: D }),
        year_bounds({ year: Y, first: F, last: L }),
        gte(D, F),
        lte(D, L),
      ),
      and(
        paid({ payer: E, payee: P, amount: A }),
        not(dated_payment({ payer: E, payee: P, amount: A })),
        service_year({ employer: E, employee: P, year: Y }),
      ),
    ),
  );
  kb.rule(agricultural({ employer: E, employee: P })).iff(
    agricultural_labor({ employer: E, employee: P }),
  );
  kb.rule(domestic({ employer: E, employee: P })).iff(
    domestic_service({ employer: E, employee: P }),
  );
  kb.rule(general({ employer: E, employee: P })).iff(
    and(
      service({ employer: E, employee: P }),
      not(agricultural({ employer: E, employee: P })),
      not(domestic({ employer: E, employee: P })),
    ),
  );
  kb.rule(general_pay({ payer: E, payee: P, amount: A, year: Y })).iff(
    and(
      payment_in({ payer: E, payee: P, amount: A, year: Y }),
      general({ employer: E, employee: P }),
    ),
  );
  kb.rule(agricultural_cash({ payer: E, payee: P, amount: A, year: Y })).iff(
    and(
      payment_in({ payer: E, payee: P, amount: A, year: Y }),
      agricultural({ employer: E, employee: P }),
      not(paid_in_kind({ payer: E, payee: P })),
    ),
  );
  kb.rule(domestic_cash({ payer: E, payee: P, amount: A, year: Y })).iff(
    and(
      payment_in({ payer: E, payee: P, amount: A, year: Y }),
      domestic({ employer: E, employee: P }),
      not(paid_in_kind({ payer: E, payee: P })),
    ),
  );
  // The year or the preceding year, the latter by arithmetic rather than by enumerating
  // the calendar, which would evaluate the payments once per year of it.
  kb.rule(general_pay_window({ payer: E, payee: P, amount: A, year: Y })).iff(
    or(
      general_pay({ payer: E, payee: P, amount: A, year: Y }),
      letIn(Y1, sub(Y, 1n), general_pay({ payer: E, payee: P, amount: A, year: Y1 })),
    ),
  );
  kb.rule(agricultural_cash_window({ payer: E, payee: P, amount: A, year: Y })).iff(
    or(
      agricultural_cash({ payer: E, payee: P, amount: A, year: Y }),
      letIn(Y1, sub(Y, 1n), agricultural_cash({ payer: E, payee: P, amount: A, year: Y1 })),
    ),
  );
  kb.rule(domestic_cash_window({ payer: E, payee: P, amount: A, year: Y })).iff(
    or(
      domestic_cash({ payer: E, payee: P, amount: A, year: Y }),
      letIn(Y1, sub(Y, 1n), domestic_cash({ payer: E, payee: P, amount: A, year: Y1 })),
    ),
  );
  kb.rule(day_in_window({ day: D, year: Y })).iff(
    and(
      year_bounds({ year: Y, first: F, last: L }),
      letIn(Y1, sub(Y, 1n), year_bounds({ year: Y1, first: F1, last: L1 })),
      gte(D, F1),
      lte(D, L),
    ),
  );
  kb.rule(general_day({ employer: E, day: D })).iff(
    and(employed_on({ employer: E, employee: P, day: D }), general({ employer: E, employee: P })),
  );
  kb.rule(agricultural_day({ employer: E, day: D })).iff(
    and(
      employed_on({ employer: E, employee: P, day: D }),
      letIn(
        N,
        count(S).where(
          and(
            employed_on({ employer: E, employee: S, day: D }),
            agricultural({ employer: E, employee: S }),
          ),
        ),
        gte(N, 5),
      ),
    ),
  );
  kb.rule(general_week({ employer: E, year: Y, week: W })).iff(
    and(
      general_day({ employer: E, day: D }),
      day_in_window({ day: D, year: Y }),
      letIn(W, floorTo(div(daysBetween(D, MONDAY), 7), 0), gte(W, 0)),
    ),
  );
  kb.rule(agricultural_week({ employer: E, year: Y, week: W })).iff(
    and(
      agricultural_day({ employer: E, day: D }),
      day_in_window({ day: D, year: Y }),
      letIn(W, floorTo(div(daysBetween(D, MONDAY), 7), 0), gte(W, 0)),
    ),
  );

  // (a) Employer.
  kb.rule(s3306_a_1_A({ employer: E, year: Y })).iff(
    letIn(
      T,
      sum(A).where(general_pay_window({ payer: E, payee: P, amount: A, year: Y })),
      gte(T, 1500),
    ),
  );
  kb.rule(s3306_a_1_B({ employer: E, year: Y })).iff(
    letIn(N, count(W).where(general_week({ employer: E, year: Y, week: W })), gte(N, 10)),
  );
  kb.rule(s3306_a_1({ employer: E, year: Y })).iff(
    or(s3306_a_1_A({ employer: E, year: Y }), s3306_a_1_B({ employer: E, year: Y })),
  );
  kb.rule(s3306_a_2_A({ employer: E, year: Y })).iff(
    letIn(
      T,
      sum(A).where(agricultural_cash_window({ payer: E, payee: P, amount: A, year: Y })),
      gte(T, 20_000),
    ),
  );
  kb.rule(s3306_a_2_B({ employer: E, year: Y })).iff(
    letIn(N, count(W).where(agricultural_week({ employer: E, year: Y, week: W })), gte(N, 10)),
  );
  kb.rule(s3306_a_2({ employer: E, year: Y })).iff(
    or(s3306_a_2_A({ employer: E, year: Y }), s3306_a_2_B({ employer: E, year: Y })),
  );
  kb.rule(s3306_a_3({ employer: E, year: Y })).iff(
    letIn(
      T,
      sum(A).where(domestic_cash_window({ payer: E, payee: P, amount: A, year: Y })),
      gte(T, 1000),
    ),
  );
  kb.rule(s3306_a({ employer: E, year: Y })).iff(
    or(
      s3306_a_1({ employer: E, year: Y }),
      s3306_a_2({ employer: E, year: Y }),
      s3306_a_3({ employer: E, year: Y }),
    ),
  );

  // (c) Employment.
  kb.rule(s3306_c_A({ employer: E, employee: P })).iff(
    and(service({ employer: E, employee: P }), not(service_abroad({ employer: E, employee: P }))),
  );
  kb.rule(s3306_c_B({ employer: E, employee: P })).iff(
    and(
      service({ employer: E, employee: P }),
      service_abroad({ employer: E, employee: P }),
      american_employer({ person: E }),
      us_citizen({ person: P }),
    ),
  );
  kb.rule(s3306_c_1_A_i({ employer: E, employee: P, year: Y })).iff(
    and(service({ employer: E, employee: P }), s3306_a_2_A({ employer: E, year: Y })),
  );
  kb.rule(s3306_c_1_A_ii({ employer: E, employee: P, year: Y })).iff(
    and(service({ employer: E, employee: P }), s3306_a_2_B({ employer: E, year: Y })),
  );
  kb.rule(s3306_c_1_A({ employer: E, employee: P, year: Y })).iff(
    or(
      s3306_c_1_A_i({ employer: E, employee: P, year: Y }),
      s3306_c_1_A_ii({ employer: E, employee: P, year: Y }),
    ),
  );
  kb.rule(s3306_c_1_B({ employer: E, employee: P })).iff(
    and(service({ employer: E, employee: P }), not(admitted_alien_farm_worker({ person: P }))),
  );
  kb.rule(s3306_c_1_A_and_B({ employer: E, employee: P, year: Y })).iff(
    and(
      s3306_c_1_A({ employer: E, employee: P, year: Y }),
      s3306_c_1_B({ employer: E, employee: P }),
    ),
  );
  kb.rule(s3306_c_1({ employer: E, employee: P, year: Y })).iff(
    and(
      agricultural({ employer: E, employee: P }),
      not(s3306_c_1_A_and_B({ employer: E, employee: P, year: Y })),
    ),
  );
  kb.rule(s3306_c_2({ employer: E, employee: P, year: Y })).iff(
    and(domestic({ employer: E, employee: P }), not(s3306_a_3({ employer: E, year: Y }))),
  );
  kb.rule(s3306_c_5_A({ employer: E, employee: P })).iff(
    and(
      service({ employer: E, employee: P }),
      or(child_of({ child: E, parent: P }), spouses({ a: E, b: P })),
    ),
  );
  kb.rule(s3306_c_5_B({ employer: E, employee: P, year: Y })).iff(
    and(
      service({ employer: E, employee: P }),
      child_of({ child: P, parent: E }),
      year_bounds({ year: Y, first: F, last: L }),
      born({ person: P, day: B }),
      gt(21, yearsBetween(L, B)),
    ),
  );
  kb.rule(s3306_c_5({ employer: E, employee: P, year: Y })).iff(
    or(
      s3306_c_5_A({ employer: E, employee: P }),
      s3306_c_5_B({ employer: E, employee: P, year: Y }),
    ),
  );
  for (const [predicate, kind] of [
    [s3306_c_6, "united states government"],
    [s3306_c_7, "state government"],
    [s3306_c_11, "foreign government"],
    [s3306_c_16, "international organization"],
  ] as const) {
    kb.rule(predicate({ employee: P, year: Y })).iff(
      or(
        works_for_institution.undated({ person: P, kind }),
        works_for_institution.inYear({ person: P, kind, year: Y }),
      ),
    );
  }
  for (const [predicate, state] of [
    [enrolled_in, enrolled_at_school],
    [nursing_enrolled_in, enrolled_at_nursing_school],
    [patient_in, hospital_patient],
    [committed_in, committed_to_penal_institution],
  ] as const) {
    const ended_before = closedPredicate(`${predicate.name}_ended_before`, {
      person: Person,
      day: Date,
    });
    const has_since = closedPredicate(`${predicate.name}_has_since`, { person: Person });
    kb.rule(ended_before({ person: P, day: D })).iff(
      and(state.until({ person: P, day: X }), gt(D, X)),
    );
    kb.rule(has_since({ person: P })).iff(state.since({ person: P, day: D }));
    kb.rule(predicate({ person: P, year: Y })).iff(
      and(
        year_bounds({ year: Y, first: F, last: L }),
        or(
          state.undated({ person: P }),
          state.inYear({ person: P, year: Y }),
          and(
            state.since({ person: P, day: D }),
            lte(D, L),
            not(ended_before({ person: P, day: F })),
          ),
          and(state.until({ person: P, day: D }), gte(D, F), not(has_since({ person: P }))),
        ),
      ),
    );
  }
  kb.rule(s3306_c_10_A_i({ employee: P, year: Y })).iff(
    and(
      or(
        works_for_institution.undated({ person: P, kind: "school" }),
        works_for_institution.inYear({ person: P, kind: "school", year: Y }),
      ),
      enrolled_in({ person: P, year: Y }),
    ),
  );
  kb.rule(s3306_c_10_A_ii({ employee: P, year: Y })).iff(
    and(
      or(
        works_for_institution.undated({ person: P, kind: "school" }),
        works_for_institution.inYear({ person: P, kind: "school", year: Y }),
      ),
      spouses({ a: P, b: S }),
      enrolled_in({ person: S, year: Y }),
    ),
  );
  kb.rule(s3306_c_10_A({ employee: P, year: Y })).iff(
    or(s3306_c_10_A_i({ employee: P, year: Y }), s3306_c_10_A_ii({ employee: P, year: Y })),
  );
  kb.rule(s3306_c_10_B({ employee: P, year: Y })).iff(
    and(
      or(
        works_for_institution.undated({ person: P, kind: "hospital" }),
        works_for_institution.inYear({ person: P, kind: "hospital", year: Y }),
      ),
      patient_in({ person: P, year: Y }),
    ),
  );
  kb.rule(s3306_c_10({ employee: P, year: Y })).iff(
    or(s3306_c_10_A({ employee: P, year: Y }), s3306_c_10_B({ employee: P, year: Y })),
  );
  kb.rule(s3306_c_13({ employee: P, year: Y })).iff(
    and(
      or(
        works_for_institution.undated({ person: P, kind: "hospital" }),
        works_for_institution.inYear({ person: P, kind: "hospital", year: Y }),
        works_for_institution.undated({ person: P, kind: "nurses training school" }),
        works_for_institution.inYear({ person: P, kind: "nurses training school", year: Y }),
      ),
      nursing_enrolled_in({ person: P, year: Y }),
    ),
  );
  kb.rule(s3306_c_21({ employee: P, year: Y })).iff(committed_in({ person: P, year: Y }));
  kb.rule(s3306_c({ employer: E, employee: P, year: Y })).iff(
    and(
      or(s3306_c_A({ employer: E, employee: P }), s3306_c_B({ employer: E, employee: P })),
      not(s3306_c_1({ employer: E, employee: P, year: Y })),
      not(s3306_c_2({ employer: E, employee: P, year: Y })),
      not(s3306_c_5({ employer: E, employee: P, year: Y })),
      not(s3306_c_21({ employee: P, year: Y })),
    ),
  );

  // (b) Wages.
  kb.rule(employee_or_dependent({ payer: E, payee: P, year: Y })).iff(
    or(
      service({ employer: E, employee: P }),
      and(
        dependent_of({ dependent: P, taxpayer: S, year: Y }),
        service({ employer: E, employee: S }),
      ),
    ),
  );
  kb.rule(s3306_b_2_A({ payer: E, payee: P, year: Y })).iff(
    and(
      paid_into_plan({
        payer: E,
        beneficiary: P,
        amount: A,
        purpose: "sickness or accident disability",
      }),
      employee_or_dependent({ payer: E, payee: P, year: Y }),
    ),
  );
  kb.rule(s3306_b_2_C({ payer: E, payee: P, year: Y })).iff(
    and(
      paid_into_plan({ payer: E, beneficiary: P, amount: A, purpose: "death" }),
      employee_or_dependent({ payer: E, payee: P, year: Y }),
    ),
  );
  kb.rule(s3306_b_2({ payer: E, payee: P, year: Y })).iff(
    or(s3306_b_2_A({ payer: E, payee: P, year: Y }), s3306_b_2_C({ payer: E, payee: P, year: Y })),
  );
  kb.rule(s3306_b_7({ payer: E, payee: P })).iff(
    and(
      service({ employer: E, employee: P }),
      paid_in_kind({ payer: E, payee: P }),
      service_outside_business({ employer: E, employee: P }),
    ),
  );
  kb.rule(paid_amount_in({ payer: E, year: Y, amount: A })).iff(
    payment_in({ payer: E, payee: P, amount: A, year: Y }),
  );
  kb.rule(s3306_b_10_A({ payer: E, year: Y, amount: A })).iff(
    and(
      or(
        termination_payment({ payer: E, payee: P, amount: A, cause: "death" }),
        termination_payment({ payer: E, payee: P, amount: A, cause: "retirement for disability" }),
      ),
      paid_amount_in({ payer: E, year: Y, amount: A }),
    ),
  );
  kb.rule(s3306_b_10_B({ payer: E, year: Y, amount: A })).iff(
    and(
      paid_under_employer_plan({ payer: E, payee: P, amount: A }),
      paid_amount_in({ payer: E, year: Y, amount: A }),
    ),
  );
  kb.rule(s3306_b_10({ payer: E, year: Y, amount: A })).iff(
    and(
      s3306_b_10_A({ payer: E, year: Y, amount: A }),
      s3306_b_10_B({ payer: E, year: Y, amount: A }),
    ),
  );
  kb.rule(s3306_b_11({ payer: E, payee: P, year: Y })).iff(
    and(
      agricultural({ employer: E, employee: P }),
      paid_in_kind({ payer: E, payee: P }),
      payment_in({ payer: E, payee: P, amount: A, year: Y }),
    ),
  );
  kb.rule(s3306_b_15({ payer: E, payee: S, year: Y })).iff(
    and(
      service({ employer: E, employee: P }),
      died({ person: P, day: D }),
      spouses({ a: P, b: S }),
      payment_in({ payer: E, payee: S, amount: A, year: Y }),
      year_bounds({ year: Y1, first: F, last: L }),
      gte(D, F),
      lte(D, L),
      gt(Y, Y1),
    ),
  );
  kb.rule(excluded_b_10({ payer: E, payee: P, year: Y })).iff(
    and(
      payment_in({ payer: E, payee: P, amount: A, year: Y }),
      s3306_b_10({ payer: E, year: Y, amount: A }),
    ),
  );
  kb.rule(s3306_b({ payer: E, payee: P, year: Y })).iff(
    and(
      payment_in({ payer: E, payee: P, amount: A, year: Y }),
      s3306_c({ employer: E, employee: P, year: Y }),
      not(s3306_b_7({ payer: E, payee: P })),
      not(excluded_b_10({ payer: E, payee: P, year: Y })),
      not(s3306_b_11({ payer: E, payee: P, year: Y })),
      not(s3306_b_15({ payer: E, payee: P, year: Y })),
    ),
  );

  // §3301.
  kb.rule(capped_wages({ payer: E, payee: P, year: Y, amount: C })).iff(
    and(
      s3306_b({ payer: E, payee: P, year: Y }),
      letIn(
        T,
        sum(A).where(payment_in({ payer: E, payee: P, amount: A, year: Y })),
        letIn(C, min(T, 7000), gte(C, 0)),
      ),
    ),
  );
  kb.rule(total_wages({ employer: E, year: Y, amount: T })).iff(
    letIn(T, sum(C).where(capped_wages({ payer: E, payee: P, year: Y, amount: C })), gte(T, 0)),
  );
  kb.rule(s3301({ employer: E, year: Y, amount: A })).iff(
    and(
      s3306_a({ employer: E, year: Y }),
      total_wages({ employer: E, year: Y, amount: T }),
      letIn(A, roundTo(mul(0.06, T), 0), gte(A, 0)),
    ),
  );
}
