# Okhsv and Oklab

`src/scales/okhsv.ts` implements the Oklab conversion, the sRGB gamut cusp and the Okhsv colour
space from Björn Ottosson's "Okhsv and Okhsl: two new color spaces for color picking"
(https://bottosson.github.io/posts/colorpicker/). The source published there is MIT licensed:

> Copyright (c) 2021 Björn Ottosson
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
> associated documentation files (the "Software"), to deal in the Software without restriction,
> including without limitation the rights to use, copy, modify, merge, publish, distribute,
> sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
> NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
> DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
> OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The colour picker's interface (`src/ui/color-picker.tsx`) is the toolkit's own: a saturation and
value plane with hue and opacity rails. It does not reproduce the layout of any third-party picker.
