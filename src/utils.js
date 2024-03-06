import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';

import { unified } from 'unified';
import { BalloonPanelView } from 'ckeditor5/src/ui';
import { global } from 'ckeditor5/src/utils';

export function getSelectedMathModelWidget( selection ) {
	const selectedElement = selection.getSelectedElement();
	if ( selectedElement && ( selectedElement.is( 'element', 'mathtex-inline' ) || selectedElement.is( 'element', 'mathtex-display' ) ) ) {
		return selectedElement;
	}
	return null;
}

// Simple MathJax 3 version check
export function isMathJaxVersion3( version ) {
	return version && typeof version === 'string' && version.split( '.' ).length === 3 && version.split( '.' )[ 0 ] === '3';
}

// Check if equation has delimiters.
export function hasDelimiters( text ) {
	return text.match( /^(\\\[.*?\\\]|\\\(.*?\\\))$/ );
}

// Find delimiters count
export function delimitersCounts( text ) {
	return text.match( /(\\\[|\\\]|\\\(|\\\))/g ).length;
}

// Extract delimiters and figure display mode for the model
export function extractDelimiters( equation ) {
	equation = equation.trim();

	// Remove delimiters (e.g. \( \) or \[ \])
	const hasInlineDelimiters = equation.includes( '\\(' ) && equation.includes( '\\)' );
	const hasDisplayDelimiters = equation.includes( '\\[' ) && equation.includes( '\\]' );
	if ( hasInlineDelimiters || hasDisplayDelimiters ) {
		equation = equation.substring( 2, equation.length - 2 ).trim();
	}

	return {
		equation,
		display: hasDisplayDelimiters
	};
}

function renderKatex( equation, el, display ) {
	const file = unified()
		.use( remarkParse )
		.use( remarkMath )
		.use( remarkRehype )
		.use( rehypeKatex )
		.use( rehypeStringify )
		.processSync( display ? `$$${ equation }$$` : `$${ equation }$` );

	el.innerHTML = String( file );
	if ( display ) {
		el.classList.add( 'katex-display' );
	}
}

export async function renderEquation(
	equation, element, engine = 'katex', lazyLoad, display = false, preview = false, previewUid, previewClassName = [],
	katexRenderOptions = {}
) {
	console.log( engine, katexRenderOptions );
	selectRenderMode( element, preview, previewUid, previewClassName, el => {
		renderKatex( equation, el, display );

		if ( preview ) {
			moveAndScaleElement( element, el );
			el.style.visibility = 'visible';
		}
	} );
}

export function getBalloonPositionData( editor ) {
	const view = editor.editing.view;
	const defaultPositions = BalloonPanelView.defaultPositions;

	const selectedElement = view.document.selection.getSelectedElement();
	if ( selectedElement ) {
		return {
			target: view.domConverter.viewToDom( selectedElement ),
			positions: [
				defaultPositions.southArrowNorth,
				defaultPositions.southArrowNorthWest,
				defaultPositions.southArrowNorthEast
			]
		};
	}
	else {
		const viewDocument = view.document;
		return {
			target: view.domConverter.viewRangeToDom( viewDocument.selection.getFirstRange() ),
			positions: [
				defaultPositions.southArrowNorth,
				defaultPositions.southArrowNorthWest,
				defaultPositions.southArrowNorthEast
			]
		};
	}
}

function selectRenderMode( element, preview, previewUid, previewClassName, cb ) {
	if ( preview ) {
		createPreviewElement( element, previewUid, previewClassName, previewEl => {
			cb( previewEl );
		} );
	} else {
		cb( element );
	}
}

function createPreviewElement( element, previewUid, previewClassName, render ) {
	const previewEl = getPreviewElement( element, previewUid, previewClassName );
	render( previewEl );
}

function getPreviewElement( element, previewUid, previewClassName ) {
	let previewEl = global.document.getElementById( previewUid );
	// Create if not found
	if ( !previewEl ) {
		previewEl = global.document.createElement( 'div' );
		previewEl.setAttribute( 'id', previewUid );
		previewEl.classList.add( ...previewClassName );
		previewEl.style.visibility = 'hidden';
		global.document.body.appendChild( previewEl );

		let ticking = false;

		const renderTransformation = () => {
			if ( !ticking ) {
				global.window.requestAnimationFrame( () => {
					moveElement( element, previewEl );
					ticking = false;
				} );

				ticking = true;
			}
		};

		// Create scroll listener for following
		global.window.addEventListener( 'resize', renderTransformation );
		global.window.addEventListener( 'scroll', renderTransformation );
	}
	return previewEl;
}

function moveAndScaleElement( parent, child ) {
	// Move to right place
	moveElement( parent, child );

	// Scale parent element same as preview
	const domRect = child.getBoundingClientRect();
	parent.style.width = domRect.width + 'px';
	parent.style.height = domRect.height + 'px';
}

function moveElement( parent, child ) {
	const domRect = parent.getBoundingClientRect();
	const left = global.window.scrollX + domRect.left;
	const top = global.window.scrollY + domRect.top;
	child.style.position = 'absolute';
	child.style.left = left + 'px';
	child.style.top = top + 'px';
	child.style.zIndex = 'var(--ck-z-panel)';
	child.style.pointerEvents = 'none';
}
