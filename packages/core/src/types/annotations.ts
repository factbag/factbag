/** JSON-compatible annotation data carried without interpretation by core. */
export type AnnotationValue =
  | null
  | boolean
  | number
  | string
  | readonly AnnotationValue[]
  | { readonly [key: string]: AnnotationValue };

/** Application-defined, serializable annotations. */
export type Annotations = Readonly<Record<string, AnnotationValue>>;
