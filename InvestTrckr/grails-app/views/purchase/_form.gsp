<%@ page import="investtrckr.Purchase" %>



<div class="fieldcontain ${hasErrors(bean: purchaseInstance, field: 'date', 'error')} required">
	<label for="date">
		<g:message code="purchase.date.label" default="Date" />
		<span class="required-indicator">*</span>
	</label>
	<g:datePicker name="date" precision="day"  value="${purchaseInstance?.date}"  />
</div>

<div class="fieldcontain ${hasErrors(bean: purchaseInstance, field: 'price', 'error')} required">
	<label for="price">
		<g:message code="purchase.price.label" default="Price" />
		<span class="required-indicator">*</span>
	</label>
	<g:field name="price" value="${fieldValue(bean: purchaseInstance, field: 'price')}" required=""/>
</div>

<div class="fieldcontain ${hasErrors(bean: purchaseInstance, field: 'quantity', 'error')} required">
	<label for="quantity">
		<g:message code="purchase.quantity.label" default="Quantity" />
		<span class="required-indicator">*</span>
	</label>
	<g:field name="quantity" type="number" value="${purchaseInstance.quantity}" required=""/>
</div>

<div class="fieldcontain ${hasErrors(bean: purchaseInstance, field: 'investment', 'error')} required">
	<label for="investment">
		<g:message code="purchase.investment.label" default="Investment" />
		<span class="required-indicator">*</span>
	</label>
	<g:select id="investment" name="investment.id" from="${investtrckr.Investment.list()}" optionKey="id" required="" value="${purchaseInstance?.investment?.id}" class="many-to-one"/>
</div>

