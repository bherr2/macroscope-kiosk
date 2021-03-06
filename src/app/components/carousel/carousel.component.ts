import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentFactory,
  ComponentFactoryResolver,
  ComponentRef,
  ElementRef,
  EmbeddedViewRef,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { debounce, forEach, map } from 'lodash';
import { SwiperComponent, SwiperConfigInterface } from 'ngx-swiper-wrapper';
import { Observable, Subject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import Swiper from 'swiper';

import { CarouselItemComponent } from '../carousel-item/carousel-item.component';

/**
 * Component responsible for managing a swiper carousel.
 */
@Component({
  selector: 'app-carousel',
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CarouselComponent implements AfterViewInit, OnChanges, OnDestroy {
  /**
   * Identifiers associated with each carousel item.
   */
  @Input() ids: number[];

  /**
   * Output emitter for index changes.
   */
  @Output() indexChange: Observable<number>;

  /**
   * Component holding the swiper instance.
   */
  @ViewChild(SwiperComponent, { static: true }) swiperComponent: SwiperComponent;

  /**
   * Swiper configuration
   */
  readonly config: SwiperConfigInterface = {
    // General
    centeredSlides: true,

    // Touch
    longSwipesRatio: .25,

    // Looping
    loop: true,
    loopFillGroupWithBlank: true,

    // Observer
    observer: true,

    // Navigation
    navigation: {
      prevEl: '.previous-button',
      nextEl: '.next-button',
    },

    // Pagination
    pagination: {
      el: '.swiper-pagination',
      type: 'bullets',
      clickable: true,
    },

    // Autoplay
    autoplay: true,

    // Keyboard Control
    keyboard: true,
  };

  /**
   * Factory for creating `CarouselItemComponent`s.
   */
  private readonly itemFactory: ComponentFactory<CarouselItemComponent>;

  /**
   * References to all `CarouselItemComponent`s, including duplicates.
   */
  private components: ComponentRef<CarouselItemComponent>[] = undefined;

  /**
   * Event emitter for index changes.
   */
  private indexChangeSubject = new Subject<number>();

  /**
   * Swiper instance.
   */
  private swiper: Swiper = undefined;

  /**
   * Creates a carousel component instance.
   * @param changeDetector Reference to this instance's `ChangeDetectorRef`.
   * @param element Anchor element on which the carousel is rendered.
   * @param viewContainer `ViewContainerRef` for this instance.
   * @param factoryResolver Resolver for factory creating carousel items.
   */
  constructor(
    private readonly changeDetector: ChangeDetectorRef,
    private readonly element: ElementRef,
    private readonly viewContainer: ViewContainerRef,
    factoryResolver: ComponentFactoryResolver
  ) {
    this.itemFactory = factoryResolver.resolveComponentFactory(CarouselItemComponent);
    this.indexChange = this.indexChangeSubject.pipe(distinctUntilChanged());
  }

  /**
   * After view initialization lifecycle hook.
   * Initializes all slides.
   */
  ngAfterViewInit() {
    this.swiper = this.swiperComponent.directiveRef.swiper();
    this.reinitialize();
  }

  /**
   * On change lifecycle hook.
   * Detects changes to `ids`.
   */
  ngOnChanges(changes: SimpleChanges) {
    if ('ids' in changes && this.swiper) {
      this.reinitialize();
    }
  }

  /**
   * On destroy lifecycle hook.
   */
  ngOnDestroy() {
    this.indexChangeSubject.complete();
    this.reinitialize.cancel();
    this.destroy();
  }

  /**
   * Callback for index change events emitted by swiper.
   * Computes the current index and emits it to `indexChange`.
   */
  indexChanged(): void {
    const { indexChangeSubject, swiper: { activeIndex, slides } } = this;
    const element: HTMLElement = slides[activeIndex];
    const index = +element.dataset.index;
    indexChangeSubject.next(index);
  }

  /**
   * Transition to the item at a specific index.
   *
   * @param index The index of the item to transition to.
   * @param [speed] The duration of transitioning to the item (ms).
   */
  slideTo(index: number, speed?: number): void {
    this.stopAutoplay();
    this.swiper.slideToLoop(index, speed);
  }

  /**
   * Starts autoplay and optionally resets the carousel position to the first item.
   *
   * @param [reset=false] Whether to reset the carousel position.
   */
  startAutoplay(reset = false): void {
    if (reset) { this.slideTo(0, 0); }
    this.swiper.autoplay.start();
  }

  /**
   * Stops autoplay and optionally resets the carousel position to the first item.
   *
   * @param [reset=false] Whether to reset the carousel position.
   */
  stopAutoplay(reset = false): void {
    if (reset) { this.slideTo(0, 0); }
    this.swiper.autoplay.stop();
  }

  /**
   * Creates and attaches to the DOM item components for each slide including duplicates.
   */
  private initialize(): void {
    const roots = this.selectItemComponentRoots();
    this.components = map(roots, r => this.createItemComponentForRoot(r));
  }

  /**
   * Detaches and destroys all item components.
   */
  private destroy(): void {
    forEach(this.components, c => this.destroyItemComponent(c));
    this.components = undefined;
  }

  /**
   * Destroys all old item components and creates new ones with the current data.
   */
  private readonly reinitialize = debounce(function reinitializeImpl(this: CarouselComponent): void { // tslint:disable-line:member-ordering
    this.destroy();
    this.initialize();
    this.changeDetector.detectChanges();
  });

  /**
   * Selects all slide elements on which item components should be attached.
   *
   * @returns A `NodeList` with the selected elements.
   */
  private selectItemComponentRoots(): NodeListOf<HTMLElement> {
    return (this.element.nativeElement as HTMLElement).querySelectorAll('.swiper-slide');
  }

  /**
   * Creates a `CarouselItemComponent`.
   *
   * @param data The data to provide as input to the component.
   * @returns A reference to the component.
   */
  private createItemComponent(data: any): ComponentRef<CarouselItemComponent> {
    const { itemFactory, viewContainer } = this;
    const component = viewContainer.createComponent(itemFactory);

    this.updateItemComponent(component, data);
    return component;
  }

  /**
   * Creates a `CarouselItemComponent` and attaches it to the DOM.
   *
   * @param root The `HTMLElement` to attach the component to.
   * @returns A reference to the component.
   */
  private createItemComponentForRoot(root: HTMLElement): ComponentRef<CarouselItemComponent> {
    const index = +root.dataset.index;
    const component = this.createItemComponent(this.ids[index]);
    const nodes = (component.hostView as EmbeddedViewRef<any>).rootNodes;

    forEach(nodes, n => root.appendChild(n));
    return component;
  }

  /**
   * Destroys a `CarouselItemComponent` including detaching it from the DOM.
   *
   * @param component The component to destroy.
   */
  private destroyItemComponent(component: ComponentRef<CarouselItemComponent>): void {
    const { viewContainer } = this;

    viewContainer.remove(viewContainer.indexOf(component.hostView));
    component.destroy();
  }

  /**
   * Updates the data for a `CarouselItemComponent`.
   *
   * @param component The component for which to update its data.
   * @param data The new data for the item component.
   */
  private updateItemComponent(component: ComponentRef<CarouselItemComponent>, data: any): void {
    const { changeDetectorRef, instance } = component;

    instance.iterationId = data;
    changeDetectorRef.detectChanges();
  }
}
