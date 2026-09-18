import * as React from "react"
import { Loader, type LoaderProps } from "./loader"

export interface SpinnerProps extends LoaderProps {}

function Spinner(props: SpinnerProps) {
  return <Loader data-slot="spinner" {...props} />
}

export { Spinner }
